/**
 * Database-integrity collector (Phase 1, R9.1–R9.9).
 *
 * Statically reviews the SQL migrations under `supabase/migrations` and emits a
 * `db-integrity` Gap_Report entry for each discovered schema problem:
 *
 * - **R9.1 / R9.2** — an inter-table relationship (a `*_id` column) that lacks a
 *   foreign-key constraint.
 * - **R9.3** — a relationship/`*_id` column used in joins/filters that lacks a
 *   covering index, and a PostGIS `geometry`/`geography` column that lacks a
 *   spatial (GIST) index.
 * - **R9.4** — a documented invariant left unenforced (here: a table with no
 *   primary-key constraint).
 * - **R9.6** — a table with RLS enabled that is missing a policy for one of the
 *   four operations (select / insert / update / delete).
 * - **R9.8** — a naming-convention deviation: tables/columns that are not
 *   `snake_case`, indexes that do not end in `_idx`/`_gix`, or functions that
 *   are not `snake_case`.
 * - **R9.9** — a function/trigger function that does not declare an explicit
 *   `security invoker | definer` context.
 *
 * The migrations are evaluated **cumulatively** (in filename order, which is the
 * `YYYYMMDDHHMMSS` apply order) so that an index, policy, or constraint added by
 * a later migration satisfies a table created by an earlier one.
 *
 * This is a heuristic static analysis, not a full SQL parser: it tokenises with
 * awareness of line/block comments, single-quoted strings, and dollar-quoted
 * function bodies, then pattern-matches the resulting statements. It reads but
 * never mutates the migration tree.
 *
 * Severity & owning phase come from {@link assignSeverityAndPhase}; because the
 * severity module maps `db-integrity` to phase 9 while the Gap_Report schema
 * constrains `owningPhase` to 2–8, the phase is clamped into the schema's range
 * (the same reconciliation the route-states collector performs with
 * `OwningPhase.parse`).
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Database_Layer (Phase 9, R9)"
 * _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.8, 9.9_
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { assignSeverityAndPhase } from "../severity";
import { gapEntryId, GapEntry, OwningPhase } from "../schema";

/** Options for {@link collectDbIntegrity}, primarily to support fixtures in tests. */
export interface DbIntegrityOptions {
    /** Absolute path to the migrations directory. Defaults to `<repoRoot>/supabase/migrations`. */
    migrationsDir?: string;
    /** Absolute repo root used to compute report-relative file paths. Defaults to `process.cwd()`. */
    repoRoot?: string;
}

/** The four DML operations an RLS policy can scope (R9.6). */
const RLS_OPERATIONS = ["select", "insert", "update", "delete"] as const;
type RlsOperation = (typeof RLS_OPERATIONS)[number];

/** A column as declared in a `CREATE TABLE` / `ALTER TABLE ADD COLUMN`. */
interface ColumnModel {
    /** Normalised column name (lower-case, unquoted). */
    name: string;
    /** Raw identifier exactly as written (used for naming-convention checks). */
    rawName: string;
    /** Raw type text (used to detect PostGIS geometry/geography). */
    type: string;
    /** True when the column carries an inline/own foreign-key reference. */
    hasForeignKey: boolean;
}

/** Aggregated model of a single table across all migrations. */
interface TableModel {
    /** Normalised table name without schema prefix. */
    name: string;
    /** Raw identifier as written at creation (for naming checks). */
    rawName: string;
    /** Migration file (repo-relative) where the table was created. */
    sourceFile: string;
    columns: Map<string, ColumnModel>;
    /** Column names that have a foreign key (inline, table-level, or via ALTER). */
    foreignKeyColumns: Set<string>;
    /** Column names covered by a primary-key constraint. */
    primaryKeyColumns: Set<string>;
    hasPrimaryKey: boolean;
}

/** A discovered index and the leading column(s) it covers. */
interface IndexModel {
    rawName: string;
    table: string;
    /** Normalised column names, in index order. */
    columns: string[];
    /** Access method (`btree`, `gist`, ...) when `USING` is present. */
    method: string | null;
    sourceFile: string;
}

/** A discovered SQL function and whether it declares a security context. */
interface FunctionModel {
    rawName: string;
    name: string;
    hasSecurityContext: boolean;
    sourceFile: string;
}

/** RLS state for a table: whether enabled and which operations have a policy. */
interface RlsModel {
    enabled: boolean;
    enabledIn: string;
    operations: Set<RlsOperation>;
}

/** The mutable accumulation shared across the migration corpus. */
interface SchemaModel {
    tables: Map<string, TableModel>;
    indexes: IndexModel[];
    functions: FunctionModel[];
    rls: Map<string, RlsModel>;
}

/** Strip surrounding double quotes and a leading `public.`/schema prefix; lower-case. */
function normalizeIdentifier(raw: string): string {
    let id = raw.trim();
    // Drop a schema qualifier (keep the final dotted segment).
    const parts = id.split(".");
    id = parts[parts.length - 1] ?? id;
    if (id.startsWith('"') && id.endsWith('"') && id.length >= 2) {
        id = id.slice(1, -1);
    }
    return id.toLowerCase();
}

/** Return the raw final identifier segment with quotes removed but case preserved. */
function rawIdentifier(raw: string): string {
    let id = raw.trim();
    const parts = id.split(".");
    id = parts[parts.length - 1] ?? id;
    if (id.startsWith('"') && id.endsWith('"') && id.length >= 2) {
        id = id.slice(1, -1);
    }
    return id;
}

/**
 * Split a SQL file into individual statements, honouring `--` line comments,
 * `/* *\/` block comments, `'...'` string literals, and `$tag$...$tag$`
 * dollar-quoted function bodies so that semicolons inside them never split.
 */
export function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = "";
    let state: "normal" | "line" | "block" | "single" | "dollar" = "normal";
    let dollarTag = "";
    let i = 0;
    const n = sql.length;

    while (i < n) {
        const ch = sql[i] ?? "";
        const two = sql.slice(i, i + 2);

        switch (state) {
            case "normal": {
                if (two === "--") {
                    state = "line";
                    i += 2;
                    continue;
                }
                if (two === "/*") {
                    state = "block";
                    i += 2;
                    continue;
                }
                if (ch === "'") {
                    state = "single";
                    current += ch;
                    i += 1;
                    continue;
                }
                const dollar = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i, i + 64));
                if (dollar) {
                    dollarTag = dollar[0];
                    state = "dollar";
                    current += dollarTag;
                    i += dollarTag.length;
                    continue;
                }
                if (ch === ";") {
                    const trimmed = current.trim();
                    if (trimmed.length > 0) {
                        statements.push(trimmed);
                    }
                    current = "";
                    i += 1;
                    continue;
                }
                current += ch;
                i += 1;
                continue;
            }
            case "line": {
                if (ch === "\n") {
                    state = "normal";
                    current += ch;
                }
                i += 1;
                continue;
            }
            case "block": {
                if (two === "*/") {
                    state = "normal";
                    i += 2;
                    continue;
                }
                i += 1;
                continue;
            }
            case "single": {
                if (two === "''") {
                    current += two;
                    i += 2;
                    continue;
                }
                current += ch;
                if (ch === "'") {
                    state = "normal";
                }
                i += 1;
                continue;
            }
            case "dollar": {
                if (sql.startsWith(dollarTag, i)) {
                    current += dollarTag;
                    i += dollarTag.length;
                    state = "normal";
                    continue;
                }
                current += ch;
                i += 1;
                continue;
            }
        }
    }

    const tail = current.trim();
    if (tail.length > 0) {
        statements.push(tail);
    }
    return statements;
}

/** Find the substring inside the parentheses that begins at/after `from`. */
function extractParens(s: string, from: number): { body: string; end: number } | null {
    const open = s.indexOf("(", from);
    if (open === -1) {
        return null;
    }
    let depth = 0;
    for (let i = open; i < s.length; i += 1) {
        const ch = s[i];
        if (ch === "(") {
            depth += 1;
        } else if (ch === ")") {
            depth -= 1;
            if (depth === 0) {
                return { body: s.slice(open + 1, i), end: i };
            }
        }
    }
    return null;
}

/** Split a parenthesised list on top-level commas (ignoring nested parens). */
function splitTopLevel(s: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of s) {
        if (ch === "(") {
            depth += 1;
            current += ch;
        } else if (ch === ")") {
            depth -= 1;
            current += ch;
        } else if (ch === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    if (current.trim().length > 0) {
        parts.push(current.trim());
    }
    return parts;
}

/** True when an item is a table-level constraint rather than a column definition. */
function isTableConstraint(item: string): boolean {
    return /^(constraint|primary\s+key|foreign\s+key|unique|check|exclude)\b/i.test(item.trim());
}

/** Get or create the model for a table name. */
function getOrCreateTable(model: SchemaModel, rawTableRef: string, sourceFile: string): TableModel {
    const name = normalizeIdentifier(rawTableRef);
    let table = model.tables.get(name);
    if (!table) {
        table = {
            name,
            rawName: rawIdentifier(rawTableRef),
            sourceFile,
            columns: new Map(),
            foreignKeyColumns: new Set(),
            primaryKeyColumns: new Set(),
            hasPrimaryKey: false,
        };
        model.tables.set(name, table);
    }
    return table;
}

/** Parse a single column definition into a {@link ColumnModel} and update table-level flags. */
function parseColumnDef(item: string, table: TableModel): void {
    const match = /^("[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\s+([\s\S]+)$/.exec(item.trim());
    if (!match || match[1] === undefined || match[2] === undefined) {
        return;
    }
    const rawName = rawIdentifier(match[1]);
    const name = normalizeIdentifier(match[1]);
    const definition = match[2];

    const hasForeignKey = /\breferences\b/i.test(definition);
    const column: ColumnModel = { name, rawName, type: definition, hasForeignKey };
    table.columns.set(name, column);

    if (hasForeignKey) {
        table.foreignKeyColumns.add(name);
    }
    if (/\bprimary\s+key\b/i.test(definition)) {
        table.hasPrimaryKey = true;
        table.primaryKeyColumns.add(name);
    }
}

/** Parse a table-level constraint, recording primary-key and foreign-key columns. */
function parseTableConstraint(item: string, table: TableModel): void {
    const pk = /\bprimary\s+key\s*\(([^)]+)\)/i.exec(item);
    if (pk && pk[1] !== undefined) {
        table.hasPrimaryKey = true;
        for (const col of pk[1].split(",")) {
            table.primaryKeyColumns.add(normalizeIdentifier(col));
        }
    }
    const fk = /\bforeign\s+key\s*\(([^)]+)\)/i.exec(item);
    if (fk && fk[1] !== undefined) {
        for (const col of fk[1].split(",")) {
            table.foreignKeyColumns.add(normalizeIdentifier(col));
        }
    }
}

/** Handle a `CREATE TABLE` statement, populating columns and constraints. */
function handleCreateTable(statement: string, sourceFile: string, model: SchemaModel): void {
    const header = /^create\s+table\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[A-Za-z0-9_.]+)/i.exec(statement);
    if (!header || header[1] === undefined) {
        return;
    }
    const table = getOrCreateTable(model, header[1], sourceFile);
    const parens = extractParens(statement, header.index + header[0].length);
    if (!parens) {
        return;
    }
    for (const item of splitTopLevel(parens.body)) {
        if (item.length === 0) {
            continue;
        }
        if (isTableConstraint(item)) {
            parseTableConstraint(item, table);
        } else {
            parseColumnDef(item, table);
        }
    }
}

/** Handle the relevant `ALTER TABLE` forms: ADD COLUMN, ADD CONSTRAINT/FK, ENABLE RLS. */
function handleAlterTable(statement: string, sourceFile: string, model: SchemaModel): void {
    const header = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("[^"]+"|[A-Za-z0-9_.]+)\s+([\s\S]+)$/i.exec(
        statement,
    );
    if (!header || header[1] === undefined || header[2] === undefined) {
        return;
    }
    const table = getOrCreateTable(model, header[1], sourceFile);
    const rest = header[2];

    if (/\benable\s+row\s+level\s+security\b/i.test(rest)) {
        const existing = model.rls.get(table.name);
        if (existing) {
            existing.enabled = true;
        } else {
            model.rls.set(table.name, { enabled: true, enabledIn: sourceFile, operations: new Set() });
        }
        return;
    }

    const addColumn = /\badd\s+column\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[A-Za-z0-9_]+)\s+([\s\S]+)$/i.exec(rest);
    if (addColumn && addColumn[1] !== undefined && addColumn[2] !== undefined) {
        const name = normalizeIdentifier(addColumn[1]);
        const hasForeignKey = /\breferences\b/i.test(addColumn[2]);
        table.columns.set(name, {
            name,
            rawName: rawIdentifier(addColumn[1]),
            type: addColumn[2],
            hasForeignKey,
        });
        if (hasForeignKey) {
            table.foreignKeyColumns.add(name);
        }
        return;
    }

    const addFk = /\badd\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)/i.exec(rest);
    if (addFk && addFk[1] !== undefined) {
        for (const col of addFk[1].split(",")) {
            table.foreignKeyColumns.add(normalizeIdentifier(col));
        }
    }
}

/** Handle a `CREATE INDEX` statement (including `UNIQUE` and `USING <method>`). */
function handleCreateIndex(statement: string, sourceFile: string, model: SchemaModel): void {
    const header =
        /^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?("[^"]+"|[A-Za-z0-9_]+)\s+on\s+("[^"]+"|[A-Za-z0-9_.]+)\s*([\s\S]*)$/i.exec(
            statement,
        );
    if (!header || header[1] === undefined || header[2] === undefined) {
        return;
    }
    const rest = header[3] ?? "";
    const methodMatch = /\busing\s+([A-Za-z0-9_]+)/i.exec(rest);
    const method = methodMatch && methodMatch[1] !== undefined ? methodMatch[1].toLowerCase() : null;
    const parens = extractParens(rest, 0);
    const columns: string[] = [];
    if (parens) {
        for (const col of splitTopLevel(parens.body)) {
            // Take the first identifier token of each index element (handles `col`,
            // `col desc`, `lower(col)` → best-effort first identifier).
            const idMatch = /("[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/.exec(col);
            if (idMatch && idMatch[1] !== undefined) {
                columns.push(normalizeIdentifier(idMatch[1]));
            }
        }
    }
    model.indexes.push({
        rawName: rawIdentifier(header[1]),
        table: normalizeIdentifier(header[2]),
        columns,
        method,
        sourceFile,
    });
}

/** Handle a `CREATE POLICY` statement, recording the operation(s) it covers. */
function handleCreatePolicy(statement: string, model: SchemaModel): void {
    const header =
        /^create\s+policy\s+(?:if\s+not\s+exists\s+)?(?:"[^"]+"|[A-Za-z0-9_]+)\s+on\s+("[^"]+"|[A-Za-z0-9_.]+)([\s\S]*)$/i.exec(
            statement,
        );
    if (!header || header[1] === undefined) {
        return;
    }
    const tableName = normalizeIdentifier(header[1]);
    const rest = header[2] ?? "";
    const forMatch = /\bfor\s+(all|select|insert|update|delete)\b/i.exec(rest);
    const op = forMatch && forMatch[1] !== undefined ? forMatch[1].toLowerCase() : "all";

    let entry = model.rls.get(tableName);
    if (!entry) {
        // A policy can be created before its ENABLE statement is parsed; track anyway.
        entry = { enabled: false, enabledIn: "", operations: new Set() };
        model.rls.set(tableName, entry);
    }
    if (op === "all") {
        for (const operation of RLS_OPERATIONS) {
            entry.operations.add(operation);
        }
    } else {
        entry.operations.add(op as RlsOperation);
    }
}

/** Handle a `CREATE FUNCTION`, recording whether it declares a security context. */
function handleCreateFunction(statement: string, sourceFile: string, model: SchemaModel): void {
    const header =
        /^create\s+(?:or\s+replace\s+)?function\s+("[^"]+"|[A-Za-z0-9_.]+)/i.exec(statement);
    if (!header || header[1] === undefined) {
        return;
    }
    const hasSecurityContext = /\bsecurity\s+(invoker|definer)\b/i.test(statement);
    model.functions.push({
        rawName: rawIdentifier(header[1]),
        name: normalizeIdentifier(header[1]),
        hasSecurityContext,
        sourceFile,
    });
}

/** Dispatch a single statement to the appropriate handler. */
function ingestStatement(statement: string, sourceFile: string, model: SchemaModel): void {
    if (/^create\s+table\b/i.test(statement)) {
        handleCreateTable(statement, sourceFile, model);
    } else if (/^alter\s+table\b/i.test(statement)) {
        handleAlterTable(statement, sourceFile, model);
    } else if (/^create\s+(?:unique\s+)?index\b/i.test(statement)) {
        handleCreateIndex(statement, sourceFile, model);
    } else if (/^create\s+policy\b/i.test(statement)) {
        handleCreatePolicy(statement, model);
    } else if (/^create\s+(?:or\s+replace\s+)?function\b/i.test(statement)) {
        handleCreateFunction(statement, sourceFile, model);
    }
}

/** True when a column name denotes an inter-table relationship (`*_id`, not the PK `id`). */
function isRelationshipColumn(name: string): boolean {
    return name !== "id" && /_id$/.test(name);
}

/** True when a column type is a PostGIS geometry/geography column. */
function isSpatialColumn(type: string): boolean {
    return /\b(geometry|geography)\b/i.test(type);
}

/** True when some index covers `column` as its leading column on `table`. */
function hasLeadingIndex(model: SchemaModel, table: string, column: string): boolean {
    return model.indexes.some((idx) => idx.table === table && idx.columns[0] === column);
}

/** True when some GIST/SPGIST index covers `column` on `table`. */
function hasSpatialIndex(model: SchemaModel, table: string, column: string): boolean {
    return model.indexes.some(
        (idx) =>
            idx.table === table &&
            idx.columns.includes(column) &&
            (idx.method === "gist" || idx.method === "spgist"),
    );
}

/** A valid `snake_case` identifier (lower-case, digits, underscores; not leading digit). */
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
/** A valid index name: snake_case ending in `_idx` or `_gix`. */
const INDEX_NAME = /^[a-z][a-z0-9_]*(?:_idx|_gix)$/;

/** Build a fully-validated {@link GapEntry} for a db-integrity finding. */
function buildEntry(detail: string, feature: string, filePath: string): GapEntry {
    const assignment = assignSeverityAndPhase({ category: "db-integrity", detail });
    // The severity module maps db-integrity to phase 9, but the Gap_Report schema
    // constrains owningPhase to 2–8. Clamp into the schema's range before parsing —
    // the same reconciliation route-states performs (its phase 6 is already in range).
    const clamped = Math.min(assignment.owningPhase ?? 8, 8);
    const owningPhase = OwningPhase.parse(clamped);
    return GapEntry.parse({
        id: gapEntryId({ category: "db-integrity", filePath, detail }),
        feature,
        readmeRef: null,
        filePaths: [filePath],
        category: "db-integrity",
        severity: assignment.severity,
        owningPhase,
        detail,
        missingState: null,
        missingObservability: null,
        reason: null,
        status: "open",
    });
}

/**
 * Parse the migrations under `migrationsDir` and emit a `db-integrity` Gap_Report
 * entry for every detected schema problem (R9.1–R9.4, R9.6, R9.8, R9.9).
 *
 * Pure with respect to the filesystem snapshot: reads but never mutates.
 *
 * @param options - optional overrides for `migrationsDir` and `repoRoot`.
 * @returns schema-valid `GapEntry[]` in deterministic order.
 */
export function collectDbIntegrity(options: DbIntegrityOptions = {}): GapEntry[] {
    const repoRoot = options.repoRoot ?? process.cwd();
    const migrationsDir = options.migrationsDir ?? path.join(repoRoot, "supabase", "migrations");

    let fileNames: string[];
    try {
        if (!statSync(migrationsDir).isDirectory()) {
            return [];
        }
        fileNames = readdirSync(migrationsDir).filter((name) => name.toLowerCase().endsWith(".sql"));
    } catch {
        return [];
    }

    // Apply order is lexicographic on the YYYYMMDDHHMMSS_ prefix.
    fileNames.sort((a, b) => a.localeCompare(b));

    const model: SchemaModel = {
        tables: new Map(),
        indexes: [],
        functions: [],
        rls: new Map(),
    };

    for (const fileName of fileNames) {
        const abs = path.join(migrationsDir, fileName);
        let sql: string;
        try {
            sql = readFileSync(abs, "utf8");
        } catch {
            continue;
        }
        const reportPath = path.relative(repoRoot, abs).split(path.sep).join("/");
        for (const statement of splitSqlStatements(sql)) {
            ingestStatement(statement, reportPath, model);
        }
    }

    const entries: GapEntry[] = [];

    // Stable iteration order over tables.
    const tableNames = [...model.tables.keys()].sort((a, b) => a.localeCompare(b));

    for (const tableName of tableNames) {
        const table = model.tables.get(tableName);
        if (!table) {
            continue;
        }
        const feature = `db: ${table.name}`;

        // R9.8 — table naming convention.
        if (!SNAKE_CASE.test(table.rawName)) {
            entries.push(
                buildEntry(
                    `Table "${table.rawName}" violates the naming convention (expected snake_case).`,
                    feature,
                    table.sourceFile,
                ),
            );
        }

        // R9.4 — missing primary-key constraint (a core data invariant).
        if (!table.hasPrimaryKey) {
            entries.push(
                buildEntry(
                    `Table "${table.name}" has no primary key constraint enforcing row identity.`,
                    feature,
                    table.sourceFile,
                ),
            );
        }

        const columns = [...table.columns.values()].sort((a, b) => a.name.localeCompare(b.name));
        for (const column of columns) {
            // R9.8 — column naming convention.
            if (!SNAKE_CASE.test(column.rawName)) {
                entries.push(
                    buildEntry(
                        `Column "${column.rawName}" on table "${table.name}" violates the naming convention (expected snake_case).`,
                        feature,
                        table.sourceFile,
                    ),
                );
            }

            const isRelationship = isRelationshipColumn(column.name);
            const hasFk = table.foreignKeyColumns.has(column.name);

            // R9.1 / R9.2 — relationship column without a foreign key.
            if (isRelationship && !hasFk) {
                entries.push(
                    buildEntry(
                        `Column "${column.name}" on table "${table.name}" looks like an inter-table relationship but has no foreign key constraint.`,
                        feature,
                        table.sourceFile,
                    ),
                );
            }

            // R9.3 — relationship column used in joins/filters without a covering index.
            if (
                isRelationship &&
                !table.primaryKeyColumns.has(column.name) &&
                !hasLeadingIndex(model, table.name, column.name)
            ) {
                entries.push(
                    buildEntry(
                        `Column "${column.name}" on table "${table.name}" is used in joins/filters but has no covering index.`,
                        feature,
                        table.sourceFile,
                    ),
                );
            }

            // R9.3 — PostGIS geometry/geography column without a spatial index.
            if (isSpatialColumn(column.type) && !hasSpatialIndex(model, table.name, column.name)) {
                entries.push(
                    buildEntry(
                        `Spatial column "${column.name}" on table "${table.name}" has no GIST spatial index for spatial queries.`,
                        feature,
                        table.sourceFile,
                    ),
                );
            }
        }

        // R9.6 — RLS enabled but missing a policy for one or more operations.
        const rls = model.rls.get(table.name);
        if (rls?.enabled) {
            for (const op of RLS_OPERATIONS) {
                if (!rls.operations.has(op)) {
                    entries.push(
                        buildEntry(
                            `Table "${table.name}" has RLS enabled but no policy granting ${op.toUpperCase()} access.`,
                            feature,
                            rls.enabledIn || table.sourceFile,
                        ),
                    );
                }
            }
        }
    }

    // R9.8 — index naming convention.
    const indexes = [...model.indexes].sort((a, b) => a.rawName.localeCompare(b.rawName));
    for (const index of indexes) {
        if (!INDEX_NAME.test(index.rawName)) {
            entries.push(
                buildEntry(
                    `Index "${index.rawName}" violates the naming convention (expected snake_case ending in _idx or _gix).`,
                    `db: ${index.table}`,
                    index.sourceFile,
                ),
            );
        }
    }

    // R9.8 / R9.9 — function naming + explicit security context.
    const functions = [...model.functions].sort((a, b) => a.rawName.localeCompare(b.rawName));
    const seenFunctions = new Set<string>();
    for (const fn of functions) {
        // A function may be re-declared (CREATE OR REPLACE) across migrations; the
        // latest declaration wins, so report once per name based on the last seen.
        const latest = functions.filter((f) => f.name === fn.name).at(-1) ?? fn;
        if (seenFunctions.has(fn.name)) {
            continue;
        }
        seenFunctions.add(fn.name);

        if (!SNAKE_CASE.test(latest.rawName)) {
            entries.push(
                buildEntry(
                    `Function "${latest.rawName}" violates the naming convention (expected snake_case).`,
                    `db: ${latest.name}`,
                    latest.sourceFile,
                ),
            );
        }
        if (!latest.hasSecurityContext) {
            entries.push(
                buildEntry(
                    `Function "${latest.name}" does not declare an explicit security invoker or security definer context.`,
                    `db: ${latest.name}`,
                    latest.sourceFile,
                ),
            );
        }
    }

    // Deterministic output ordering.
    entries.sort((a, b) => {
        const fa = a.filePaths[0] ?? "";
        const fb = b.filePaths[0] ?? "";
        if (fa !== fb) {
            return fa.localeCompare(fb);
        }
        return a.detail.localeCompare(b.detail);
    });

    return entries;
}

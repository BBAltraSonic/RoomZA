/** Bounded, structured diagnostics for disposable clones. Never retain SQL text. */
const knownObjects = new Set([
  'postgis', 'postgis_topology', 'postgis_raster', 'pgcrypto',
  'pg_stat_statements', 'pgsodium', 'pg_cron', 'pg_net', 'pgaudit',
  'pg_tle', 'supabase_vault', 'supautils',
]);
const knownFunctions = new Set([
  'apply_listing_import_rollback_snapshot', 'prepare_listing_import_rollback_batch',
  'acknowledge_listing_import_rollback_batch', 'finish_listing_import_rollback',
  'commit_imported_listing', 'commit_listing_import_job',
  'prepare_listing_import_drafts', 'pinpoint_property_command', 'pinpoint_property_photo',
]);

export function createCloneCrashDiagnostics({ requestId, container, maxRecords = 32, maxLineChars = 8192 }) {
  const records = [], fragments = new Map();
  const counts = { crashSignals: 0, crashedStatements: 0, functionContexts: 0 };
  function remember(detail) {
    records.push({ requestId, container, ...detail });
    if (records.length > maxRecords) records.shift();
  }
  function inspect(line) {
    const signal = /server process \(PID (\d+)\).*?signal (\d+)/i.exec(line);
    if (signal) {
      counts.crashSignals++;
      remember({ kind: 'backend_crash', pid: Number(signal[1]), signal: Number(signal[2]) });
    }
    const failed = /Failed process was running:\s*(.*)/i.exec(line);
    if (failed) {
      const statement = failed[1].trim();
      const operation = /^(create(?:\s+or\s+replace)?\s+(?:extension|function|table|view|trigger|index|schema)|alter\s+(?:extension|function|role|table)|drop\s+(?:extension|function|table|view|trigger|index|schema|role|database|policy)|update|delete\s+from|insert\s+into|select|grant|revoke|commit|rollback|begin|set|show|do)\b/i.exec(statement);
      let object = null;
      if (operation) {
        const rest = statement.slice(operation[0].length).trim().replace(/^if\s+(?:not\s+)?exists\s+/i, '');
        const candidate = /^"?([a-z][a-z0-9_]*)"?(?=\s|;|$)/i.exec(rest)?.[1]?.toLowerCase();
        if (knownObjects.has(candidate)) object = candidate;
      }
      counts.crashedStatements++;
      remember({ kind: 'crashed_statement', operation: operation?.[0].replace(/\s+/g, ' ').toUpperCase() ?? 'UNCLASSIFIED', object, rawSQLRetained: false });
    }
    const context = /PL\/pgSQL function (?:(?:public|private)\.)?([a-z][a-z0-9_]*)\([^)]*\) line (\d+)/i.exec(line);
    if (context) {
      counts.functionContexts++;
      remember({ kind: 'function_context', functionName: knownFunctions.has(context[1]) ? context[1] : null, line: Number(context[2]), argumentsRetained: false });
    }
  }
  return {
    feed(stream, chunk) {
      if (stream !== 'stdout' && stream !== 'stderr') throw new Error('Unknown crash-log stream');
      const lines = ((fragments.get(stream) ?? '') + chunk.toString()).split(/\r?\n/);
      fragments.set(stream, lines.pop().slice(0, maxLineChars));
      for (const line of lines) inspect(line.slice(0, maxLineChars));
    },
    finish() {
      for (const fragment of fragments.values()) if (fragment) inspect(fragment);
      fragments.clear();
      return { records, counts, maxRecords, maxLineChars, rawSQLRetained: false };
    },
  };
}

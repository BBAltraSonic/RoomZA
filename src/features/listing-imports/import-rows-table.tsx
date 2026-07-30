"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useMemo, useRef } from "react";

import { StatusBadge } from "@/components/premium/primitives";
import { cn } from "@/lib/utils";

import type { CanonicalImportListing, DuplicateStrategy, ImportRowState } from "./types";

export type WorkspaceIssue = {
  id: string;
  severity: "blocking" | "publish_blocker" | "warning";
  code: string;
  field: string | null;
  message: string;
  resolved_at?: string | null;
};

export type WorkspaceRow = {
  id: string;
  row_number: number;
  state: ImportRowState;
  normalized_data: CanonicalImportListing;
  duplicate_candidate_ids: string[];
  duplicate_strategy: DuplicateStrategy | null;
  duplicate_listing_id: string | null;
  publication_selected: boolean;
  resulting_listing_id: string | null;
  listing_import_issues: WorkspaceIssue[];
};

const helper = createColumnHelper<WorkspaceRow>();

export function ImportRowsTable({
  rows,
  selectedIds,
  onSelectionChange,
  onResolveDuplicate,
}: {
  rows: WorkspaceRow[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onResolveDuplicate: (row: WorkspaceRow, strategy: DuplicateStrategy) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => [
    helper.display({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          aria-label="Select visible rows"
          checked={rows.length > 0 && rows.every((row) => selectedIds.has(row.id))}
          onChange={(event) => {
            const next = new Set(selectedIds);
            rows.forEach((row) => event.target.checked ? next.add(row.id) : next.delete(row.id));
            onSelectionChange(next);
          }}
          className="size-4 accent-forest"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Select row ${row.original.row_number}`}
          checked={selectedIds.has(row.original.id)}
          onChange={(event) => {
            const next = new Set(selectedIds);
            if (event.target.checked) next.add(row.original.id);
            else next.delete(row.original.id);
            onSelectionChange(next);
          }}
          className="size-4 accent-forest"
        />
      ),
      size: 44,
    }),
    helper.accessor("row_number", { header: "Row", cell: (info) => info.getValue(), size: 64 }),
    helper.accessor((row) => row.normalized_data.title, {
      id: "title",
      header: "Listing",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{row.original.normalized_data.title ?? "Untitled"}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.normalized_data.address ?? "No address"}</p>
        </div>
      ),
      size: 280,
    }),
    helper.accessor((row) => row.normalized_data.price ?? row.normalized_data.salePrice, {
      id: "price",
      header: "Price",
      cell: (info) => info.getValue() ? `R ${Number(info.getValue()).toLocaleString("en-ZA")}` : "—",
      size: 120,
    }),
    helper.accessor("state", {
      header: "Status",
      cell: ({ row }) => {
        const state = row.original.state;
        const tone = state === "draft_ready" || state === "committed" || state === "published"
          ? "success"
          : state === "parse_blocked" || state === "failed"
            ? "error"
            : "warning";
        return <StatusBadge tone={tone}>{state.replaceAll("_", " ")}</StatusBadge>;
      },
      size: 145,
    }),
    helper.display({
      id: "issues",
      header: "Review",
      cell: ({ row }) => {
        const activeIssues = row.original.listing_import_issues?.filter((issue) => !issue.resolved_at) ?? [];
        if (!activeIssues.length) return <span className="inline-flex items-center gap-1 text-xs font-medium text-status-success-text"><CheckCircle2 className="size-3.5" /> Ready</span>;
        return (
          <div className="max-w-72">
            <p className="flex items-center gap-1 text-xs font-semibold text-status-warning-text">
              <AlertCircle className="size-3.5" />
              {activeIssues[0]!.message}
            </p>
            {activeIssues.length > 1 ? <p className="mt-1 text-xs text-muted-foreground">+{activeIssues.length - 1} more</p> : null}
          </div>
        );
      },
      size: 280,
    }),
    helper.display({
      id: "duplicate",
      header: "Duplicate action",
      cell: ({ row }) => row.original.duplicate_candidate_ids.length ? (
        <select
          aria-label={`Duplicate action for row ${row.original.row_number}`}
          value={row.original.duplicate_strategy ?? ""}
          onChange={(event) => onResolveDuplicate(row.original, event.target.value as DuplicateStrategy)}
          className="h-9 rounded-md border border-input bg-panel px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Review…</option>
          <option value="skip">Skip</option>
          <option value="replace">Replace mutable fields</option>
          <option value="merge">Merge empty fields</option>
          <option value="import_new">Import as new draft</option>
        </select>
      ) : "—",
      size: 190,
    }),
  ], [onResolveDuplicate, onSelectionChange, rows, selectedIds]);
  // TanStack Table exposes mutable helpers; this component intentionally opts out of compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel">
      <div className="hidden min-w-[1120px] border-b border-border bg-warm-surface md:flex">
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <div key={header.id} style={{ width: header.getSize() }} className="shrink-0 px-3 py-3 text-xs font-semibold uppercase text-muted-foreground">
            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        ))}
      </div>
      <div ref={scrollRef} className="max-h-[34rem] overflow-auto" role="grid" aria-rowcount={rows.length}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", minWidth: 1120 }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = table.getRowModel().rows[virtualRow.index]!;
            const blocker = row.original.listing_import_issues?.some((issue) => issue.severity === "blocking" && !issue.resolved_at);
            return (
              <div
                key={row.id}
                role="row"
                tabIndex={0}
                data-blocker={blocker || undefined}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  const target = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="row"]')[virtualRow.index + (event.key === "ArrowDown" ? 1 : -1)];
                  target?.focus();
                }}
                className={cn(
                  "absolute left-0 flex min-h-[72px] w-full border-b border-border/70 text-sm outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  blocker && "bg-status-error-surface/35",
                )}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} role="gridcell" style={{ width: cell.column.getSize() }} className="flex shrink-0 items-center px-3 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

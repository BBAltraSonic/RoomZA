import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AdminHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Platform operations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function AdminMetricBand({ items }: { items: { label: string; value: ReactNode; detail?: string; tone?: "forest" | "clay" | "error" }[] }) {
  return (
    <dl className="grid overflow-hidden rounded-xl border border-border bg-panel shadow-[var(--elevation-1)] sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <div key={item.label} className={cn("px-5 py-4", index > 0 && "border-t border-border sm:border-l sm:border-t-0", index > 1 && "sm:border-t xl:border-t-0")}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className={cn("mt-2 text-2xl font-semibold text-ink", item.tone === "forest" && "text-forest", item.tone === "clay" && "text-clay", item.tone === "error" && "text-destructive")}>{item.value}</dd>
          {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function AdminTable({ headers, children, empty }: { headers: string[]; children: ReactNode; empty?: boolean }) {
  if (empty) return <div className="rounded-xl border border-border bg-panel px-6 py-12 text-center text-sm text-muted-foreground">No records match these filters.</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-[var(--elevation-1)]">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="border-b border-border px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminRowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-semibold text-ink underline-offset-4 hover:text-forest hover:underline">{children}</Link>;
}

export function AdminFilters({ q, status, statuses = [], role, roles = [], priority, assignee, from, to, showDates = false }: { q?: string; status?: string; statuses?: { value: string; label: string }[]; role?: string; roles?: { value: string; label: string }[]; priority?: string; assignee?: string; from?: string; to?: string; showDates?: boolean }) {
  return (
    <form className="mb-4 flex flex-col gap-2 rounded-xl bg-panel p-3 shadow-[var(--neu-inset-sm)] sm:flex-row">
      <Input name="q" defaultValue={q} placeholder="Search" aria-label="Search records" className="sm:max-w-sm" />
      {statuses.length ? (
        <select name="status" defaultValue={status ?? ""} aria-label="Filter status" className="h-11 rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8">
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      ) : null}
      {roles.length ? <select name="role" defaultValue={role ?? ""} aria-label="Filter role" className="h-11 rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8"><option value="">All roles</option>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : null}
      {priority !== undefined ? <select name="priority" defaultValue={priority} aria-label="Filter priority" className="h-11 rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)] outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8"><option value="">All priorities</option>{["low", "normal", "high", "urgent"].map((value) => <option key={value} value={value}>{value}</option>)}</select> : null}
      {assignee !== undefined ? <Input name="assignee" defaultValue={assignee} placeholder="Assignee UUID" aria-label="Filter assignee" className="sm:max-w-48" /> : null}
      {showDates ? <><Input type="date" name="from" defaultValue={from} aria-label="From date" /><Input type="date" name="to" defaultValue={to} aria-label="To date" /></> : null}
      <Button type="submit" variant="outline">Apply</Button>
    </form>
  );
}

export function AdminNextPage({ cursor, params }: { cursor?: string | number | null; params: Record<string, string | undefined> }) {
  if (!cursor) return null;
  const query = new URLSearchParams(Object.entries({ ...params, cursor: String(cursor) }).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return <div className="mt-4 flex justify-end"><Button render={<Link href={`?${query.toString()}`} />} variant="outline">Next 50</Button></div>;
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="bg-panel px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

"use client";

import { AlertTriangle, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/premium/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  calculateTrueMonthlyCost,
  formatRand,
  type HouseholdSize,
  type TransportMethod,
} from "@/features/listings/true-monthly-cost";
import { cn } from "@/lib/utils";

import type { ListingDetail } from "./types";

export function TrueMonthlyCostCard({ listing, compact }: { listing: ListingDetail; compact?: boolean }) {
  const [householdSize, setHouseholdSize] = useState<HouseholdSize>(1);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("none");
  const [workplaceLabel, setWorkplaceLabel] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const estimate = useMemo(
    () =>
      calculateTrueMonthlyCost(listing, {
        householdSize,
        transportMethod,
        workplaceLabel: workplaceLabel.trim(),
        monthlyTransportCost: Number(transportCost) || 0,
      }),
    [householdSize, listing, transportCost, transportMethod, workplaceLabel],
  );

  const largestAmount = Math.max(...estimate.rows.map((row) => row.amount), 1);

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">True Monthly Cost</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatRand(estimate.total)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
          </p>
        </div>
        <StatusBadge tone="neutral">Estimate</StatusBadge>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <div>
          <Label htmlFor="household-size" className="text-xs font-semibold uppercase text-muted-foreground">
            Household
          </Label>
          <Select value={String(householdSize)} onValueChange={(value) => setHouseholdSize(Number(value) as HouseholdSize)}>
            <SelectTrigger id="household-size" className="mt-2 w-full bg-panel shadow-none focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size === 5 ? "5+ people" : `${size} ${size === 1 ? "person" : "people"}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="transport-method" className="text-xs font-semibold uppercase text-muted-foreground">
            Transport
          </Label>
          <Select value={transportMethod} onValueChange={(value) => setTransportMethod(value as TransportMethod)}>
            <SelectTrigger id="transport-method" className="mt-2 w-full bg-panel shadow-none focus:ring-ring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not added</SelectItem>
              <SelectItem value="taxi">Taxi</SelectItem>
              <SelectItem value="public_transport">Bus or rail</SelectItem>
              <SelectItem value="driving">Driving</SelectItem>
              <SelectItem value="uber">Uber/e-hailing</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="workplace-label" className="text-xs font-semibold uppercase text-muted-foreground">
            Workplace
          </Label>
          <Input
            id="workplace-label"
            value={workplaceLabel}
            onChange={(event) => setWorkplaceLabel(event.target.value)}
            placeholder="Century City"
            className="mt-2 bg-panel shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
          />
        </div>

        <div>
          <Label htmlFor="transport-cost" className="text-xs font-semibold uppercase text-muted-foreground">
            Monthly commute
          </Label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              R
            </span>
            <Input
              id="transport-cost"
              type="number"
              min={0}
              value={transportCost}
              onChange={(event) => setTransportCost(event.target.value)}
              placeholder="1200"
              className="bg-panel pl-8 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
            />
          </div>
        </div>
      </div>

      {estimate.warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {estimate.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{warning}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 divide-y divide-border rounded-md border border-border bg-panel">
        {estimate.rows.map((row) => {
          const isExpanded = expandedCategory === row.category;
          const width = `${Math.max(4, (row.amount / largestAmount) * 100)}%`;

          return (
            <div key={row.category} className="px-3 py-2.5">
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : row.category)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{row.label}</span>
                    <span className="text-sm font-semibold text-ink">{formatRand(row.amount)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-forest/70" style={{ width }} />
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </button>
              {isExpanded ? (
                <div className="mt-2 flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <p>{row.detail}</p>
                  <span className="shrink-0 rounded-md bg-warm-surface px-2 py-1 font-medium text-ink">{row.source}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

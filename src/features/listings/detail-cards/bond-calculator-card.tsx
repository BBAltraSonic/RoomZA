"use client";

import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/premium/primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRand } from "@/features/listings/true-monthly-cost";
import { calculateMonthlyBond, DEFAULT_BOND_INTEREST_RATE, DEFAULT_BOND_TERM_YEARS } from "@/features/purchase/bond-calculator";
import { cn } from "@/lib/utils";

import type { ListingDetail } from "./types";

export function BondCalculatorCard({ listing, compact }: { listing: ListingDetail; compact?: boolean }) {
  const purchasePrice = listing.display_price ?? listing.sale_price ?? listing.price;
  const [deposit, setDeposit] = useState(() => String(Math.round(purchasePrice * 0.1)));
  const [interestRate, setInterestRate] = useState(String(DEFAULT_BOND_INTEREST_RATE));
  const [loanTerm, setLoanTerm] = useState(String(DEFAULT_BOND_TERM_YEARS));

  const estimate = useMemo(
    () =>
      calculateMonthlyBond({
        purchasePrice,
        deposit: Number(deposit) || 0,
        annualInterestRate: Number(interestRate) || DEFAULT_BOND_INTEREST_RATE,
        loanTermYears: Number(loanTerm) || DEFAULT_BOND_TERM_YEARS,
      }),
    [deposit, interestRate, loanTerm, purchasePrice],
  );

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-forest" />
            <h2 className="text-sm font-semibold text-ink">Bond estimate</h2>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {formatRand(estimate.monthlyRepayment)}
            <span className="ml-1 text-sm font-medium text-muted-foreground">/month</span>
          </p>
        </div>
        <StatusBadge tone="neutral">Estimate</StatusBadge>
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <MoneyInput id="bond-price" name="bond-price" label="Purchase price" value={purchasePrice} readOnly />
        <MoneyInput id="bond-deposit" name="bond-deposit" label="Deposit" value={deposit} onChange={setDeposit} />
        <NumberInput id="bond-rate" label="Interest rate" suffix="%" value={interestRate} onChange={setInterestRate} step="0.25" />
        <NumberInput id="bond-term" label="Loan term" suffix="years" value={loanTerm} onChange={setLoanTerm} step="1" />
      </div>
    </section>
  );
}

function MoneyInput({
  id,
  name,
  label,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  name: string;
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R</span>
        <Input
          id={id}
          name={name}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          readOnly={readOnly}
          className="bg-panel pl-8 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
        />
      </div>
    </div>
  );
}

function NumberInput({
  id,
  label,
  suffix,
  value,
  onChange,
  step,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      <div className="relative mt-2">
        <Input
          id={id}
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="bg-panel pr-16 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

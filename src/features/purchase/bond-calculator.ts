export const DEFAULT_BOND_INTEREST_RATE = 11.75;
export const DEFAULT_BOND_TERM_YEARS = 20;
export const DEFAULT_BOND_DEPOSIT_PERCENT = 10;

export type BondEstimateInput = {
  purchasePrice: number;
  deposit?: number;
  annualInterestRate?: number;
  loanTermYears?: number;
};

export type BondEstimate = {
  purchasePrice: number;
  deposit: number;
  principal: number;
  annualInterestRate: number;
  loanTermYears: number;
  monthlyRepayment: number;
};

function toFiniteMoney(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value !== undefined ? Math.max(0, Math.round(value)) : fallback;
}

export function calculateMonthlyBond({
  purchasePrice,
  deposit,
  annualInterestRate = DEFAULT_BOND_INTEREST_RATE,
  loanTermYears = DEFAULT_BOND_TERM_YEARS,
}: BondEstimateInput): BondEstimate {
  const normalizedPrice = toFiniteMoney(purchasePrice, 0);
  const defaultDeposit = Math.round(normalizedPrice * (DEFAULT_BOND_DEPOSIT_PERCENT / 100));
  const normalizedDeposit = Math.min(toFiniteMoney(deposit, defaultDeposit), normalizedPrice);
  const principal = Math.max(0, normalizedPrice - normalizedDeposit);
  const normalizedRate = Number.isFinite(annualInterestRate) ? Math.max(0, annualInterestRate) : DEFAULT_BOND_INTEREST_RATE;
  const normalizedTerm = Number.isFinite(loanTermYears) ? Math.max(1, Math.round(loanTermYears)) : DEFAULT_BOND_TERM_YEARS;
  const months = normalizedTerm * 12;
  const monthlyRate = normalizedRate / 100 / 12;

  const monthlyRepayment =
    principal === 0
      ? 0
      : monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -months);

  return {
    purchasePrice: normalizedPrice,
    deposit: normalizedDeposit,
    principal,
    annualInterestRate: normalizedRate,
    loanTermYears: normalizedTerm,
    monthlyRepayment: Math.round(monthlyRepayment),
  };
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string) {
  if (typeof price === "string") return price;
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}

export const formatCurrency = formatPrice;

export function getProfileDisplayName(profile: { email?: string | null } | null | undefined) {
  if (!profile?.email) return "User";
  return profile.email.split("@")[0] || "User";
}

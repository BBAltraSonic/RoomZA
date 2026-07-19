import { DISCOVERY_RANKING_FACTS } from "@/features/map-discovery/ranking";

import type { TrustDocumentCategory } from "./types";

export type TrustCatalogItem = {
  slug: string;
  title: string;
  summary: string;
  category: TrustDocumentCategory;
  actionLabel: string;
};

export const trustCatalog: TrustCatalogItem[] = [
  { slug: "safety", title: "Safety Centre", summary: "Safer viewings, applications, listings, conversations, and scam prevention.", category: "safety", actionLabel: "Stay safe" },
  { slug: "verification", title: "Verification Centre", summary: "What each trust signal proves, and what it does not prove.", category: "trust", actionLabel: "Understand verification" },
  { slug: "reporting-policy", title: "Reporting Policy", summary: "Report a listing, profile, message, or photo and understand what happens next.", category: "safety", actionLabel: "Report a concern" },
  { slug: "privacy", title: "Privacy Policy", summary: "How personal information is used, retained, protected, and controlled under POPIA.", category: "legal", actionLabel: "Control your data" },
  { slug: "terms", title: "Terms of Service", summary: "The rules for using Pinpoint and the platform's marketplace role.", category: "legal", actionLabel: "Read the terms" },
  { slug: "community-guidelines", title: "Community Guidelines", summary: "Simple standards for respectful, honest, and safe participation.", category: "community", actionLabel: "Read the guidelines" },
  { slug: "content-policy", title: "Listing and Content Policy", summary: "Allowed property content and how misleading or unlawful listings are handled.", category: "community", actionLabel: "Check listing rules" },
  { slug: "messaging-policy", title: "Messaging Policy", summary: "Rules against abuse, spam, phishing, and fraudulent payment requests.", category: "community", actionLabel: "Read chat rules" },
  { slug: "cookies", title: "Cookie Policy", summary: "Essential authentication, map, and interface-storage technologies.", category: "legal", actionLabel: "Review technologies" },
  { slug: "payments-refunds", title: "Payments and Refunds", summary: "The launch gate for future subscriptions, premium products, and fees.", category: "legal", actionLabel: "Review payment status" },
  { slug: "copyright", title: "Copyright Policy", summary: "Removal requests for copied photos, descriptions, and floor plans.", category: "legal", actionLabel: "Protect your work" },
  { slug: "accessibility", title: "Accessibility Statement", summary: "Pinpoint's commitment to keyboard, assistive-technology, and readable access.", category: "accessibility", actionLabel: "Read our commitment" },
  { slug: "ai-policy", title: "AI Policy", summary: "Disclosure and safeguards for future recommendation, fraud, and moderation assistance.", category: "technology", actionLabel: "Understand AI use" },
  { slug: "transparency", title: "Transparency Centre", summary: "Discovery ordering, moderation process, verification, and thresholded metrics.", category: "trust", actionLabel: "See how Pinpoint works" },
];

export const trustCategoryLabels: Record<TrustDocumentCategory, string> = {
  legal: "Legal and privacy",
  safety: "Safety and reporting",
  trust: "Trust and transparency",
  community: "Community rules",
  accessibility: "Inclusive access",
  technology: "Technology governance",
};

export const discoveryRankingFacts = DISCOVERY_RANKING_FACTS;

export function findTrustCatalogItem(slug: string) {
  return trustCatalog.find((item) => item.slug === slug) ?? null;
}

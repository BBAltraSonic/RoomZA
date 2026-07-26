import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Gauge,
  Heart,
  Home,
  Map,
  MessageCircle,
  ShieldCheck,
  User,
  Users,
  Activity,
  BellRing,
  BookOpenText,
  FileCheck2,
  History,
  LockKeyhole,
  UserCog,
} from "lucide-react";

import type { Role } from "@/lib/roles";

export type NavigationAudience = "guest" | "renter" | "landlord" | "admin";
export type NavigationPlacement = "primary" | "secondary" | "admin-core";
export type NavigationMatch = "exact" | "prefix";

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  match: NavigationMatch;
  placement: NavigationPlacement;
  ownerOnly?: boolean;
  discovery?: "compact" | "wide";
};

export type AdminNavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const renterNavigation: NavigationItem[] = [
  { id: "explore", label: "Explore", href: "/", icon: Map, match: "exact", placement: "primary" },
  { id: "saved", label: "Saved", href: "/saved", icon: Heart, match: "prefix", placement: "primary", discovery: "compact" },
  { id: "applications", label: "Applications", href: "/applications", icon: ClipboardList, match: "prefix", placement: "primary", discovery: "compact" },
  { id: "messages", label: "Messages", href: "/messages", icon: MessageCircle, match: "prefix", placement: "primary", discovery: "compact" },
  { id: "profile", label: "Profile", href: "/profile", icon: User, match: "prefix", placement: "primary" },
];

export const landlordNavigation: NavigationItem[] = [
  { id: "explore", label: "Explore", href: "/", icon: Map, match: "exact", placement: "primary" },
  { id: "listings", label: "Listings", href: "/dashboard", icon: Building2, match: "prefix", placement: "primary", discovery: "compact" },
  { id: "applicants", label: "Applicants", href: "/dashboard/applicants", icon: Users, match: "prefix", placement: "primary", discovery: "compact" },
  { id: "viewings", label: "Viewings", href: "/dashboard/viewings", icon: CalendarDays, match: "prefix", placement: "primary", discovery: "wide" },
  { id: "messages", label: "Messages", href: "/messages", icon: MessageCircle, match: "prefix", placement: "primary", discovery: "compact" },
];

const adminItem = (
  id: string,
  label: string,
  href: string,
  icon: LucideIcon,
  options: Pick<NavigationItem, "ownerOnly" | "placement"> = { placement: "secondary" },
): NavigationItem => ({ id, label, href, icon, match: href === "/admin" ? "exact" : "prefix", ...options });

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    label: "Overview",
    items: [
      adminItem("overview", "Overview", "/admin", Gauge, { placement: "admin-core" }),
      adminItem("inbox", "Inbox", "/admin/inbox", BellRing, { placement: "admin-core" }),
    ],
  },
  {
    label: "Moderation",
    items: [
      adminItem("reports", "Reports", "/admin/reports", FileWarning, { placement: "admin-core" }),
      adminItem("users", "Users", "/admin/users", Users),
      adminItem("listings", "Listings", "/admin/listings", Building2),
      adminItem("verifications", "Verifications", "/admin/verifications", ShieldCheck),
    ],
  },
  {
    label: "Marketplace",
    items: [
      adminItem("applications", "Applications", "/admin/applications", ClipboardList),
      adminItem("viewings", "Viewings", "/admin/viewings", CalendarDays),
    ],
  },
  {
    label: "Content and compliance",
    items: [
      adminItem("blog", "Blog", "/admin/blog", BookOpenText),
      adminItem("trust", "Trust content", "/admin/trust", FileCheck2),
      adminItem("privacy", "Privacy requests", "/admin/privacy-requests", LockKeyhole),
      adminItem("transparency", "Transparency", "/admin/transparency", Gauge),
    ],
  },
  {
    label: "Platform and access",
    items: [
      adminItem("operations", "Operations", "/admin/operations", Activity, { placement: "admin-core" }),
      adminItem("audit", "Audit", "/admin/audit", History),
      adminItem("members", "Admin members", "/admin/settings/admins", UserCog, { placement: "secondary", ownerOnly: true }),
      adminItem("security", "Security", "/admin/security", ShieldCheck),
    ],
  },
];

export const publicNavigation: NavigationItem[] = [
  { id: "map", label: "Map", href: "/", icon: Map, match: "exact", placement: "primary" },
  { id: "browse", label: "Listings", href: "/listings", icon: Home, match: "prefix", placement: "primary" },
  { id: "blog", label: "Blog", href: "/blog", icon: BookOpenText, match: "prefix", placement: "primary" },
  { id: "trust", label: "Trust", href: "/trust", icon: ShieldCheck, match: "prefix", placement: "primary" },
];

export function navigationAudience(isAuthenticated: boolean, role: Role | null | undefined): NavigationAudience {
  if (!isAuthenticated) return "guest";
  return role === "landlord" ? "landlord" : "renter";
}

export function primaryNavigationFor(audience: NavigationAudience): NavigationItem[] {
  if (audience === "landlord") return landlordNavigation;
  if (audience === "renter") return renterNavigation;
  if (audience === "guest") return publicNavigation;
  return [];
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.id === "listings" && item.href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/listings/");
  }
  if (item.id === "applications" && item.href === "/applications" && pathname === "/journey") {
    return true;
  }
  if (
    item.id === "applicants" &&
    (pathname === "/dashboard/buyers" || pathname.startsWith("/dashboard/buyers/"))
  ) {
    return true;
  }
  return item.match === "exact" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const focusedRoutePatterns = [
  /^\/auth(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
  /^\/policy-acceptance(?:\/|$)/,
  /^\/account-suspended(?:\/|$)/,
  /^\/messages\/[^/]+(?:\/|$)/,
  /^\/viewings\/[^/]+\/live(?:\/|$)/,
  /^\/listing\/[^/]+(?:\/|$)/,
  /^\/dashboard\/listings\/new(?:\/|$)/,
  /^\/dashboard\/listings\/[^/]+\/edit(?:\/|$)/,
];

export function isFocusedNavigationRoute(pathname: string): boolean {
  return focusedRoutePatterns.some((pattern) => pattern.test(pathname));
}

export function isPublicContentRoute(pathname: string): boolean {
  return (
    pathname === "/listings" ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/trust") ||
    pathname.startsWith("/lister/") ||
    pathname.startsWith("/neighborhoods/")
  );
}

export function isUserWorkspaceRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname === "/saved" ||
    pathname === "/applications" ||
    pathname === "/messages" ||
    pathname === "/profile" ||
    pathname === "/settings"
  );
}

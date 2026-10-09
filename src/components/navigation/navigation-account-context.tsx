"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/lib/roles";
import type { NavigationAudience } from "./navigation-config";

export type NavigationContextValue = {
  audience: NavigationAudience;
  currentRole?: Role | null;
  isAuthenticated: boolean;
  profileMenu?: ReactNode;
};

export const NavigationContext = createContext<NavigationContextValue>({
  audience: "guest",
  currentRole: null,
  isAuthenticated: false,
});

export const AdminMenuContext = createContext<{ isOwner: boolean } | null>(null);

export function useDiscoveryAccount() {
  return useContext(NavigationContext);
}

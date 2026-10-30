"use client";

import { createContext, useContext } from "react";
import type { DiscoveryVertical } from "./verticals";

export type WorkspaceNavigation = {
  /** Changes environment in the address bar without asking the server for anything. */
  go: (href: string, vertical: DiscoveryVertical) => void;
  /** Property keeps its own filters, so returning to it restores them. */
  propertySearch: () => string;
};

/** Absent outside the workspace, where discovery links are ordinary navigations. */
export const WorkspaceNavigationContext = createContext<WorkspaceNavigation | null>(null);

export function useWorkspaceNavigation() {
  return useContext(WorkspaceNavigationContext);
}

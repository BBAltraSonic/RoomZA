"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

// Prevent clicks on streamed HTML before its mutation handlers are attached.
export function useWorkspaceReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}

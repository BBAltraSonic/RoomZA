"use client";

import { useSyncExternalStore } from "react";

// The theme lives on <html class="dark">: set before paint by the layout's
// bootstrap script and toggled by the profile menu.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

/** Whether the app is in dark mode, kept in step with the theme toggle. */
export function useDarkTheme() {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

/** Keep discovery snapshots fresh while visible and after browser history restores. */
export function observeDiscoveryRefresh(refresh: () => Promise<void>) {
  const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
  const poll = setInterval(onVisible, 15_000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", onVisible);
  return () => { clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pageshow", onVisible); };
}

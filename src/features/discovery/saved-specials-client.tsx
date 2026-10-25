"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { authPathForRedirect } from "@/lib/redirects";
export type SpecialCategory = "shopping" | "tourism" | "event";
export type SavedSpecialTarget = { category: SpecialCategory; id: string };
export const specialKey = (target: SavedSpecialTarget) => target.category + ":" + target.id;
type SaveState = { saved: Set<string>; pending: Set<string>; counts: Record<string, number>; mutate: (target: SavedSpecialTarget, count: number, desired?: boolean) => Promise<void> };
const Saves = createContext<SaveState | null>(null);
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function SavedSpecialsProvider({ children, initialTargets }: { children: ReactNode; initialTargets?: SavedSpecialTarget[] }) {
  const [saved, setSaved] = useState(() => new Set(initialTargets?.map(specialKey))), [pending, setPending] = useState<Set<string>>(new Set()), [counts, setCounts] = useState<Record<string, number>>({}), [error, setError] = useState("");
  const savedRef = useRef(saved), authenticated = useRef(initialTargets !== undefined), ready = useRef(initialTargets !== undefined), initialized = useRef(initialTargets !== undefined), busy = useRef(new Set<string>()), loading = useRef<Promise<SavedSpecialTarget[]> | null>(null);
  const load = useCallback(() => {
    if (!loading.current) loading.current = fetch("/api/saved-specials?stateOnly=1", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Saved Specials could not be loaded.");
      const result = await response.json();
      if (typeof result.authenticated !== "boolean" || !Array.isArray(result.targets) || result.targets.some((target: SavedSpecialTarget) => !target || !["shopping", "tourism", "event"].includes(target.category) || typeof target.id !== "string")) throw new Error("Saved Specials could not be loaded.");
      authenticated.current = result.authenticated; ready.current = true;
      return result.targets as SavedSpecialTarget[];
    }).finally(() => { loading.current = null; });
    return loading.current;
  }, []);
  const applyLoaded = useCallback((targets: SavedSpecialTarget[]) => {
    if (initialized.current) return;
    initialized.current = true; savedRef.current = new Set(targets.map(specialKey)); setSaved(savedRef.current);
  }, []);
  useEffect(() => {
    if (initialTargets !== undefined) return;
    let active = true;
    void load().then(targets => { if (active) applyLoaded(targets); }).catch(() => { if (active) setError("Saved Specials could not be loaded. Try the heart again to retry."); });
    return () => { active = false; };
  }, [load, applyLoaded, initialTargets]);
  function updateSaved(key: string, value: boolean) {
    const next = new Set(savedRef.current); if (value) next.add(key); else next.delete(key); savedRef.current = next; setSaved(next);
  }
  async function mutate(target: SavedSpecialTarget, count: number, desired?: boolean) {
    const key = specialKey(target); if (busy.current.has(key)) return; busy.current.add(key);
    setPending(previous => new Set(previous).add(key)); setError("");
    let wasSaved = savedRef.current.has(key), changed = false; const previousCount = counts[key] ?? count;
    try {
      if (!ready.current) applyLoaded(await load());
      if (!authenticated.current) { window.location.assign(authPathForRedirect(window.location.pathname + window.location.search)); return; }
      wasSaved = savedRef.current.has(key); const shouldSave = desired ?? !wasSaved;
      if (shouldSave === wasSaved) return;
      changed = true; updateSaved(key, shouldSave);
      setCounts(previous => ({ ...previous, [key]: Math.max(0, previousCount + (shouldSave ? 1 : -1)) }));
      const response = await fetch("/api/saved-specials", { method: shouldSave ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: target.category, id: target.id }) });
      if (!response.ok) throw new Error("The Special could not be updated. Please try again.");
      const result = await response.json();
      if (result.saved !== shouldSave || !Number.isInteger(result.savedCount) || result.savedCount < 0) throw new Error("The Special could not be updated. Please try again.");
      setCounts(previous => ({ ...previous, [key]: result.savedCount }));
    } catch (caught) {
      if (changed) { updateSaved(key, wasSaved); setCounts(previous => ({ ...previous, [key]: previousCount })); }
      setError(caught instanceof Error ? caught.message : "Saving failed.");
    } finally { busy.current.delete(key); setPending(previous => { const next = new Set(previous); next.delete(key); return next; }); }
  }
  return <Saves.Provider value={{ saved, pending, counts, mutate }}>{children}{error ? <p role="alert" className="absolute bottom-4 left-4 z-50 max-w-sm rounded-xl border border-status-error-border bg-status-error-surface p-3 text-sm text-status-error-text">{error}</p> : null}</Saves.Provider>;
}
export function useSavedSpecial(target: SavedSpecialTarget, count: number) {
  const hydrated = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const state = useContext(Saves), key = specialKey(target);
  const mutate = (desired?: boolean) => state ? state.mutate(target, count, desired) : Promise.resolve(window.location.assign(authPathForRedirect(window.location.pathname + window.location.search)));
  return { saved: state?.saved.has(key) ?? false, pending: !hydrated || (state?.pending.has(key) ?? false), count: state?.counts[key] ?? count, toggle: () => mutate(), remove: () => mutate(false) };
}

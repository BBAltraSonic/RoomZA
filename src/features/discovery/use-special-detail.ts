"use client";
import { useEffect, useRef, useState } from "react";
import { observeDiscoveryRefresh } from "./refresh";
import { openSpecialDirections, parseSpecialDetail, specialApiPath, type SpecialDetailState, type SpecialDetailTarget } from "./special-detail-data";

export function useSpecialDetail(target: SpecialDetailTarget, initial?: SpecialDetailState) {
  const { id, category } = target;
  const [detail, setDetail] = useState<SpecialDetailState | null>(initial ?? null);
  const [checking, setChecking] = useState(true), [error, setError] = useState(""), [acting, setActing] = useState(false), [retry, setRetry] = useState(0);
  const deadline = useRef(0), action = useRef<AbortController | null>(null);
  useEffect(() => {
    let disposed = false, sequence = 0;
    let request: AbortController | undefined, alarm: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      request?.abort(); clearTimeout(timeout); action.current?.abort(); action.current = null; setActing(false);
      const controller = new AbortController(), current = ++sequence, started = performance.now(); request = controller; setChecking(true);
      timeout = setTimeout(() => controller.abort("timeout"), 12000);
      try {
        const response = await fetch(specialApiPath({ id, category }), { cache: "no-store", signal: controller.signal });
        if (![200, 404, 410].includes(response.status)) throw new Error("Unavailable");
        const fresh = parseSpecialDetail({ id, category }, await response.json());
        if (disposed || controller.signal.aborted || current !== sequence) return;
        clearTimeout(alarm);
        deadline.current = fresh.item ? started + Date.parse(fresh.item.endsAt) - Date.parse(fresh.serverNow) : 0;
        if (fresh.item && deadline.current <= performance.now()) { fresh.item = null; fresh.status = "expired"; }
        setDetail(fresh); setChecking(false); setError("");
        const boundary = fresh.status === "upcoming" || fresh.status === "scheduled"
          ? Math.min(fresh.item ? deadline.current : Infinity, started + Date.parse(fresh.startsAt!) - Date.parse(fresh.serverNow)) : fresh.item ? deadline.current : null;
        if (boundary !== null) alarm = setTimeout(() => {
          if (fresh.item && performance.now() >= deadline.current) { deadline.current = 0; setDetail({ ...fresh, item: null, status: "expired" }); }
          void refresh();
        }, Math.max(0, Math.min(boundary - performance.now(), 2147483647)));
      } catch {
        if (disposed || current !== sequence || (controller.signal.aborted && controller.signal.reason !== "timeout")) return;
        clearTimeout(alarm); deadline.current = 0; setDetail(null); setChecking(false);
        setError("Could not check this special. Try again before travelling.");
      } finally { if (request === controller) clearTimeout(timeout); }
    }
    void refresh(); const stop = observeDiscoveryRefresh(refresh);
    const hidden = () => { if (document.visibilityState === "hidden") { setChecking(true); action.current?.abort(); } };
    document.addEventListener("visibilitychange", hidden);
    return () => { disposed = true; request?.abort(); action.current?.abort(); clearTimeout(alarm); clearTimeout(timeout); stop(); document.removeEventListener("visibilitychange", hidden); };
  }, [id, category, retry]);
  async function directions() {
    if (!detail?.item || checking || action.current) return;
    if (performance.now() >= deadline.current) { setDetail({ ...detail, item: null, status: "expired" }); setRetry(value => value + 1); return; }
    const controller = new AbortController(); action.current = controller; setActing(true); setError("");
    const timeout = setTimeout(() => controller.abort("timeout"), 12000);
    try { await openSpecialDirections(target, controller.signal, deadline.current); }
    catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") {
        setDetail(null); setError("Directions are unavailable. Check this special again.");
      }
    } finally { clearTimeout(timeout); if (action.current === controller) { action.current = null; setActing(false); } }
  }
  return { detail, checking, error, acting, directions, refresh: () => setRetry(value => value + 1) };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { serviceDetailSchema, type PublicService } from "./schema";

type State = { status: "loading" | "ready" | "unavailable" | "error"; item: PublicService | null };
const loading: State = { status: "loading", item: null };

/** The detail content is keyed by ID so old content and requests never survive a switch. */
export function useServiceDetail(id: string) {
  const [state, setState] = useState<State>(loading);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), 12000);
    let disposed = false;
    void (async () => {
      try {
        const response = await fetch("/api/services/" + id, { cache: "no-store", signal: controller.signal });
        if (![200, 404].includes(response.status)) throw new Error("Service unavailable");
        const { item } = serviceDetailSchema.parse(await response.json());
        if (item && (item.id !== id || response.status !== 200)) throw new Error("Wrong service");
        if (!disposed && !controller.signal.aborted) setState({ status: item ? "ready" : "unavailable", item });
      } catch {
        if (!disposed) setState({ status: "error", item: null });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); };
  }, [id, attempt]);
  const retry = useCallback(() => { setState(loading); setAttempt(value => value + 1); }, []);
  return { ...state, retry };
}

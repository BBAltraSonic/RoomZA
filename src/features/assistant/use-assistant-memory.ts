"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearDeviceMemory,
  emptyMemory,
  isMemoryEmpty,
  loadMemory,
  memoryToJson,
  mergeMemories,
  sanitizeMemory,
  saveMemory,
  type AssistantMemory,
} from "./memory";

export type MemoryHome = "device" | "account";

const ENDPOINT = "/api/assistant/memory";
const WRITE_DELAY_MS = 400;

async function putMemory(memory: AssistantMemory) {
  const response = await fetch(ENDPOINT, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memory: memoryToJson(memory) }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Memory not saved");
}

/**
 * Where the customer's memory lives. Guests keep it on this device. Signed-in people keep it in
 * their account: on first load, anything on the device moves into the account and the device
 * copy is cleared. If the account can't be reached, the device copy keeps working.
 */
export function useAssistantMemory() {
  const [memory, setMemory] = useState<AssistantMemory>(() => loadMemory());
  const [home, setHome] = useState<MemoryHome>("device");
  const homeRef = useRef<MemoryHome>("device");
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(memory);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(ENDPOINT, { signal: controller.signal, cache: "no-store" });
        if (!response?.ok) return;
        const payload = (await response.json()) as { data?: { memory?: unknown } };
        if (controller.signal.aborted) return;
        const account = sanitizeMemory(payload.data?.memory);
        const device = loadMemory();
        const merged = mergeMemories(account, device);
        if (!isMemoryEmpty(device)) {
          await putMemory(merged);
          clearDeviceMemory();
        }
        if (controller.signal.aborted) return;
        homeRef.current = "account";
        latest.current = merged;
        setHome("account");
        setMemory(merged);
      } catch {
        // Signed out or unreachable: memory stays on this device.
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      // Leaving with a write still waiting: send it now.
      if (pending.current && homeRef.current === "account") {
        clearTimeout(pending.current);
        void putMemory(latest.current).catch(() => undefined);
      }
    },
    [],
  );

  const update = useCallback((next: AssistantMemory) => {
    latest.current = next;
    setMemory(next);
    if (homeRef.current === "device") {
      saveMemory(next);
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void putMemory(latest.current).catch(() => undefined);
    }, WRITE_DELAY_MS);
  }, []);

  const forgetAll = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    latest.current = emptyMemory();
    setMemory(emptyMemory());
    clearDeviceMemory();
    if (homeRef.current === "account") void fetch(ENDPOINT, { method: "DELETE" }).catch(() => undefined);
  }, []);

  return { memory, home, update, forgetAll };
}

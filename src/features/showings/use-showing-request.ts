"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { ActionResult } from "@/lib/action-result";
import type { ShowingRequest } from "./actions";

type Options = {
  read: () => Promise<ActionResult<{ request: ShowingRequest | null }>>;
  filter: string;
  initialRequest?: ShowingRequest | null;
  watchNewRequests?: boolean;
  onActionError?: (message: string) => void;
};

const STATUS_ORDER: Record<ShowingRequest["status"], number> = {
  requested: 0, accepted: 1, checked_in: 2,
  declined: 3, cancelled: 3, completed: 3, expired: 3,
};

/** One scoped read/subscription and one synchronous action lock per surface. */
export function useShowingRequest({ read, filter, initialRequest, watchNewRequests = false, onActionError }: Options) {
  const client = useMemo(() => createClient(), []);
  const channelId = useId();
  const [request, setRequest] = useState<ShowingRequest | null>(initialRequest ?? null);
  const currentRequest = useRef(request);
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(initialRequest === undefined);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const mounted = useRef(false), generation = useRef(0), revision = useRef(0);
  const pending = useRef(false), reading = useRef<{ token: object; promise: Promise<void> } | null>(null), queued = useRef(false);
  const retryAction = useRef<(() => void) | null>(null);
  const invalidate = useCallback(() => { generation.current++; revision.current++; }, []);

  const applyRequest = useCallback((next: ShowingRequest | null) => {
    if (!mounted.current) return;
    const current = currentRequest.current;
    // A delayed read/action must not undo a newer event for the same request.
    if (current && next?.id === current.id &&
      (STATUS_ORDER[next.status] < STATUS_ORDER[current.status] ||
        (STATUS_ORDER[current.status] === 3 && next.status !== current.status))) return;
    revision.current++;
    currentRequest.current = next;
    setRequest(next);
    setReadError(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async function reload(): Promise<void> {
    if (!mounted.current) return;
    if (reading.current) { queued.current = true; return reading.current.promise; }
    const epoch = generation.current, version = revision.current;
    const token = {};
    const task: Promise<void> = (async () => {
      try {
        const result = await Promise.resolve().then(read);
        if (!mounted.current || epoch !== generation.current || version !== revision.current) return;
        if (!result.success) { setReadError(result.error); return; }
        let next = result.data.request;
        // Active-only inbox reads omit finished requests. Recover the known row
        // through participant/session RLS when reconnecting after a missed event.
        const known = currentRequest.current;
        if (!next && known) {
          const recovered = await client.from("showing_requests").select("*").eq("id", known.id).maybeSingle();
          if (!mounted.current || epoch !== generation.current || version !== revision.current) return;
          if (recovered.error) { setReadError("Showing requests could not be loaded. Try again."); return; }
          next = recovered.data;
        }
        applyRequest(next);
      } catch {
        if (mounted.current && epoch === generation.current && version === revision.current) {
          setReadError("Showing requests could not be loaded. Try again.");
        }
      } finally {
        if (mounted.current && epoch === generation.current) setLoading(false);
        if (reading.current?.token === token) {
          reading.current = null;
          if (queued.current && mounted.current && epoch === generation.current) {
            queued.current = false;
            queueMicrotask(() => void reload());
          }
        }
      }
    })();
    reading.current = { token, promise: task };
    return task;
  }, [applyRequest, client, read]);

  const run = useCallback(async function execute<T>(label: string, work: (isCurrent: () => boolean) => Promise<ActionResult<T>>, done?: (data: T) => void): Promise<void> {
    if (!mounted.current || pending.current) return;
    const epoch = generation.current;
    pending.current = true;
    setPendingAction(label);
    setActionError(null);
    const fail = (message: string) => {
      setActionError(message);
      onActionError?.(message);
      retryAction.current = () => { if (epoch === generation.current) void execute(label, work, done); };
    };
    try {
      const result = await work(() => mounted.current && epoch === generation.current);
      if (!mounted.current || epoch !== generation.current) return;
      if (!result.success) { fail(result.error); return; }
      retryAction.current = null;
      if (result.data && typeof result.data === "object" && "request" in result.data) {
        applyRequest((result.data as { request: ShowingRequest | null }).request);
      }
      done?.(result.data);
    } catch {
      if (mounted.current && epoch === generation.current) fail("The showing action could not be confirmed. Check the current status and try again.");
    } finally {
      if (mounted.current && epoch === generation.current) {
        pending.current = false;
        setPendingAction(null);
      }
    }
  }, [applyRequest, onActionError]);

  const seedKey = initialRequest ? `${initialRequest.id}:${initialRequest.status}:${initialRequest.conversation_id ?? ""}` : "";
  const previousSeed = useRef(seedKey);
  useEffect(() => {
    if (previousSeed.current !== seedKey) { previousSeed.current = seedKey; void refresh(); }
  }, [refresh, seedKey]);

  useEffect(() => {
    mounted.current = true;
    invalidate();
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    let actorId: string | undefined;
    const { data: auth } = client.auth.onAuthStateChange((event, session) => {
      const next = session?.user.id;
      if (event === "SIGNED_OUT" || (actorId && next && actorId !== next)) {
        invalidate();
        pending.current = false;
        reading.current = null;
        queued.current = false;
        retryAction.current = null;
        currentRequest.current = null;
        setRequest(null);
        setPendingAction(null);
        setActionError(null);
        setReadError(null);
        setLoading(false);
      }
      actorId = next;
      // Never await Auth work while Supabase dispatches its session callback.
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") queueMicrotask(() => void refresh());
    });
    return () => {
      mounted.current = false;
      invalidate();
      pending.current = false;
      reading.current = null;
      queued.current = false;
      retryAction.current = null;
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
      auth.subscription.unsubscribe();
    };
  }, [client, invalidate, refresh]);

  const activeRequestId = request && STATUS_ORDER[request.status] < 3 ? request.id : null;
  const subscriptionFilter = watchNewRequests ? filter : activeRequestId ? `id=eq.${activeRequestId}` : null;
  useEffect(() => {
    if (!subscriptionFilter) return;
    const channel = client.channel(`showing_surface_${channelId}`);
    if (watchNewRequests) channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "showing_requests", filter: subscriptionFilter }, () => void refresh());
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "showing_requests", filter: subscriptionFilter }, payload => {
      const next = payload.new as ShowingRequest;
      const current = currentRequest.current;
      if (current && next.id === current.id && next.listing_id === current.listing_id && next.status in STATUS_ORDER) applyRequest(next);
      else void refresh();
    }).subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
    return () => { void client.removeChannel(channel); };
  }, [applyRequest, channelId, client, refresh, subscriptionFilter, watchNewRequests]);

  return { request, applyRequest, refresh, readError, actionError, isLoading, pendingAction, run,
    retry: () => retryAction.current?.() };
}

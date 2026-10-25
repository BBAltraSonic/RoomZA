import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  publishJsonJob: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: () => mocks.createAdminClient(),
}));
vi.mock("@/lib/qstash", () => ({
  publishJsonJob: (...args: unknown[]) => mocks.publishJsonJob(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn, error: mocks.error, debug: mocks.debug },
}));

import { recordAndEnqueueNotifications } from "./outbox";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publishJsonJob.mockResolvedValue({ skipped: true });
});

describe("notification event handoff", () => {
  it("retains a persisted event when queue publication fails", async () => {
    const select = vi.fn(async () => ({ data: [{ id: "event-1" }], error: null }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ insert: () => ({ select }) }) });
    mocks.publishJsonJob.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(recordAndEnqueueNotifications({
      recipient_id: "recipient-1", type: "incoming_call", payload: {},
      idempotency_key: "incoming_call:ringing:session-1",
    })).resolves.toBeUndefined();
    expect(mocks.error).toHaveBeenCalledWith("Notification queue publish failed", expect.objectContaining({ eventId: "event-1" }));
  });

  it("does not queue or overwrite on a duplicate idempotency key", async () => {
    const select = vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ insert: () => ({ select }) }) });
    await recordAndEnqueueNotifications({
      recipient_id: "recipient-1", type: "incoming_call", payload: {},
      idempotency_key: "incoming_call:ringing:session-1",
    });
    expect(mocks.publishJsonJob).not.toHaveBeenCalled();
  });
  it("persists and queues a new recipient when a mixed batch also contains an existing alert", async () => {
    const duplicate = { code: "23505", message: 'duplicate key value violates unique constraint "notification_events_idempotency_key_idx"' };
    const select = vi.fn()
      .mockResolvedValueOnce({ data: null, error: duplicate })
      .mockResolvedValueOnce({ data: null, error: duplicate })
      .mockResolvedValueOnce({ data: [{ id: "event-new" }], error: null });
    const insert = vi.fn(() => ({ select }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ insert }) });
    const oldEvent = { recipient_id: "recipient-old", type: "viewing_proposed" as const, payload: {}, idempotency_key: "viewing:old" };
    const newEvent = { ...oldEvent, recipient_id: "recipient-new", idempotency_key: "viewing:new" };
    await recordAndEnqueueNotifications([oldEvent, newEvent]);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(insert).toHaveBeenNthCalledWith(1, [oldEvent, newEvent]);
    expect(insert).toHaveBeenNthCalledWith(2, [oldEvent]);
    expect(insert).toHaveBeenNthCalledWith(3, [newEvent]);
    expect(mocks.publishJsonJob).toHaveBeenCalledTimes(1);
    expect(mocks.publishJsonJob).toHaveBeenCalledWith(expect.any(String), { eventId: "event-new" }, "notification:event-new");
    expect(mocks.warn).not.toHaveBeenCalled();
  });
  it("still reports a different unique-constraint failure without splitting or queueing", async () => {
    const select = vi.fn(async () => ({ data: null, error: { code: "23505", message: 'duplicate key violates unique constraint "notification_events_pkey"' } }));
    const insert = vi.fn(() => ({ select }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ insert }) });
    const event = { recipient_id: "recipient-1", type: "new_message" as const, payload: {} };
    await recordAndEnqueueNotifications([event, event]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(mocks.publishJsonJob).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith("Failed to record notification events", expect.objectContaining({ count: 2 }));
  });
  it("persists recipient events through the server admin client before queueing their IDs", async () => {
    const select = vi.fn(async () => ({ data: [{ id: "event-1" }], error: null }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mocks.createAdminClient.mockReturnValue({ from });

    const event = {
      recipient_id: "recipient-1",
      type: "new_message" as const,
      idempotency_key: "new_message:message-1",
      payload: { message: "You have a new message." },
    };
    await recordAndEnqueueNotifications(event);

    expect(from).toHaveBeenCalledWith("notification_events");
    expect(insert).toHaveBeenCalledWith([event]);
    expect(mocks.publishJsonJob).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/notifications/send"),
      { eventId: "event-1" },
      "notification:event-1",
    );
  });

  it("does not queue an event when persistence fails", async () => {
    const select = vi.fn(async () => ({ data: null, error: { message: "insert failed" } }));
    mocks.createAdminClient.mockReturnValue({ from: () => ({ insert: () => ({ select }) }) });

    await recordAndEnqueueNotifications({
      recipient_id: "recipient-1",
      type: "new_message",
      idempotency_key: "new_message:message-1",
      payload: {},
    });

    expect(mocks.publishJsonJob).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith(
      "Failed to record notification events",
      expect.objectContaining({ count: 1, error: "insert failed" }),
    );
  });
});

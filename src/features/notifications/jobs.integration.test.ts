import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendEmail: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/send", () => ({
  sendEmail: (to: string, subject: string, html: string) => mocks.sendEmail(to, subject, html),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { processNotificationJob } from "./jobs";

type EventRow = {
  id: string;
  recipient_id: string;
  type: string;
  payload: { message?: string } | null;
  attempt_count?: number | null;
  profiles: { email: string } | { email: string }[] | null;
};

function makeClient(event: EventRow | null) {
  const updates: Array<Record<string, unknown>> = [];

  class Builder {
    private updatePayload: Record<string, unknown> | null = null;

    update(payload: Record<string, unknown>) {
      this.updatePayload = payload;
      updates.push(payload);
      return this;
    }

    eq() {
      return this;
    }

    is() {
      return this;
    }

    select() {
      return this;
    }

    async single() {
      return {
        data: event,
        error: event ? null : { message: "not found" },
      };
    }
  }

  return {
    updates,
    from: vi.fn((table: string) => {
      if (table !== "notification_events") {
        throw new Error(`Unexpected table ${table}`);
      }
      return new Builder();
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processNotificationJob integration flow", () => {
  it("locks, sends, and marks a notification event as sent", async () => {
    const client = makeClient({
      id: "event-1",
      recipient_id: "user-1",
      type: "new_message",
      payload: { message: "You have a new message." },
      attempt_count: 0,
      profiles: { email: "user@example.com" },
    });
    mocks.createClient.mockReturnValue(client);
    mocks.sendEmail.mockResolvedValue({ data: { id: "email-1" } });

    const result = await processNotificationJob("event-1", "request-1");

    expect(result).toEqual({ sent: true });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      "user@example.com",
      "RoomZA notification",
      expect.stringContaining("You have a new message."),
    );
    expect(client.updates.at(-1)).toMatchObject({
      sent_at: expect.any(String),
      locked_at: null,
      last_error: null,
    });
  });

  it("records retry metadata when email delivery fails", async () => {
    const client = makeClient({
      id: "event-1",
      recipient_id: "user-1",
      type: "new_message",
      payload: { message: "You have a new message." },
      attempt_count: 1,
      profiles: [{ email: "user@example.com" }],
    });
    mocks.createClient.mockReturnValue(client);
    mocks.sendEmail.mockResolvedValue({ error: new Error("provider down") });

    const result = await processNotificationJob("event-1", "request-1");

    expect(result).toEqual({
      sent: false,
      code: "server_error",
      message: "Notification send failed.",
      httpStatus: 500,
    });
    expect(client.updates.at(-1)).toMatchObject({
      attempt_count: 2,
      last_error: "provider down",
      locked_at: null,
      next_attempt_at: expect.any(String),
    });
  });
});

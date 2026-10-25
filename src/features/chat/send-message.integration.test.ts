import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  recordAndEnqueueNotifications: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  recordAndEnqueueNotifications: (event: unknown) => mocks.recordAndEnqueueNotifications(event),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { sendMessage } from "./actions";

type TableName = "conversations" | "messages" | "notification_events";

type InsertedRow = {
  id?: string;
  conversation_id?: string;
  sender_id?: string;
  listing_id?: string;
  content?: string;
  recipient_id?: string;
  type?: string;
  idempotency_key?: string;
  payload?: Record<string, unknown>;
};

function createClientMock({
  userId = "renter-1",
  conversation = { renter_id: "renter-1", landlord_id: "landlord-1", listing_id: "listing-1" },
  messageError = null,
  recoveredMessage = null,
}: {
  userId?: string | null;
  conversation?: { renter_id: string; landlord_id: string; listing_id: string } | null;
  messageError?: { message: string } | null;
  recoveredMessage?: { id: string; content: string } | null;
} = {}) {
  const inserts: Partial<Record<TableName, InsertedRow[]>> = {};

  class QueryBuilder {
    private readonly rows: InsertedRow[] | undefined;

    constructor(private readonly table: TableName, rows?: InsertedRow[]) {
      this.rows = rows;
    }

    select() {
      return this;
    }

    eq() {
      return this;
    }

    insert(payload: InsertedRow) {
      (inserts[this.table] ??= []).push(payload);
      return new QueryBuilder(this.table, [payload]);
    }

    async single() {
      if (this.table === "conversations") {
        return {
          data: conversation,
          error: conversation ? null : { message: "not found" },
        };
      }
      if (this.table === "messages") {
        if (messageError) {
          return { data: null, error: messageError };
        }
        const row = this.rows?.[0];
        return {
          data: {
            id: row?.id ?? "message-1",
            conversation_id: row?.conversation_id,
            sender_id: row?.sender_id,
            listing_id: row?.listing_id,
            content: row?.content,
            created_at: "2026-07-02T10:00:00.000Z",
            read_at: null,
          },
          error: null,
        };
      }
      return { data: { id: "notification-1" }, error: null };
    }

    async maybeSingle() {
      return { data: recoveredMessage, error: null };
    }
  }

  return {
    inserts,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    from: vi.fn((table: TableName) => new QueryBuilder(table)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendMessage integration flow", () => {
  it("inserts a sanitized message and enqueues a recipient notification", async () => {
    const client = createClientMock();
    mocks.createClient.mockResolvedValue(client);

    const result = await sendMessage("conversation-1", "  Hello <script>alert(1)</script>  ", "listing-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recipientId).toBe("landlord-1");
      expect(result.data.message.content).not.toContain("<script>");
    }
    expect(client.inserts.messages?.[0]).toMatchObject({
      conversation_id: "conversation-1",
      sender_id: "renter-1",
      listing_id: "listing-1",
      content: "Hello",
    });
    expect(mocks.recordAndEnqueueNotifications).toHaveBeenCalledWith({
      recipient_id: "landlord-1",
      actor_id: "renter-1",
      source_kind: "message",
      source_id: "message-1",
      category: "messages",
      type: "new_message",
      idempotency_key: "new_message:message-1",
      payload: {
        conversationId: "conversation-1",
        listingId: "listing-1",
        message: "You have a new message.",
      },
    });
  });

  it("rejects non-participants without inserting a message or notification", async () => {
    const client = createClientMock({ userId: "stranger-1" });
    mocks.createClient.mockResolvedValue(client);

    const result = await sendMessage("conversation-1", "Hello", "listing-1");

    expect(result).toEqual({ success: false, error: "You are not part of this conversation." });
    expect(client.inserts.messages).toBeUndefined();
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });

  it("uses the client's stable UUID and recovers a committed insert after response loss", async () => {
    const id = "958b97de-d3d1-44aa-bce9-7e295165af12";
    const client = createClientMock({ messageError: { message: "Lost response" }, recoveredMessage: { id, content: "Hello" } });
    mocks.createClient.mockResolvedValue(client);
    const result = await sendMessage("conversation-1", "Hello", "listing-1", id);
    expect(result.success).toBe(true);
    expect(client.inserts.messages?.[0]?.id).toBe(id);
    expect(mocks.recordAndEnqueueNotifications).toHaveBeenCalledWith(expect.objectContaining({ idempotency_key: `new_message:${id}` }));
  });

  it("does not treat reuse of an ID with different content as a successful send", async () => {
    const id = "958b97de-d3d1-44aa-bce9-7e295165af12";
    const client = createClientMock({ messageError: { message: "Unique violation" }, recoveredMessage: { id, content: "Earlier message" } });
    mocks.createClient.mockResolvedValue(client);
    expect((await sendMessage("conversation-1", "Hello", "listing-1", id)).success).toBe(false);
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });

  it("keeps a saved message successful when notification recording throws", async () => {
    const client = createClientMock(); mocks.createClient.mockResolvedValue(client);
    mocks.recordAndEnqueueNotifications.mockRejectedValueOnce(new Error("Synthetic outbox outage"));
    expect((await sendMessage("conversation-1", "Hello", "listing-1")).success).toBe(true);
    expect(client.inserts.messages).toHaveLength(1);
  });

  it.each(["", "not-a-uuid"])("rejects invalid retry identity %j before querying", async (id) => {
    expect((await sendMessage("conversation-1", "Hello", "listing-1", id)).success).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each(["   ", "x".repeat(2001)])("rejects empty or oversized content before querying", async (content) => {
    expect((await sendMessage("conversation-1", content, "listing-1")).success).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mocks.createClient() }));
vi.mock("@/features/profile/interaction-data", () => ({ getInteractionProfileMap: async () => new Map() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
import { getConversation, getConversations, getMessages } from "./actions";
function client({ failingTable, missing = false }: { failingTable?: string; missing?: boolean } = {}) {
  class Query {
    constructor(private table: string) {}
    select() { return this; }
    eq() { return this; }
    or() { return this; }
    order() { return this; }
    result(single: boolean) {
      if (this.table === failingTable) return { data: null, error: { code: "503", message: "Synthetic database unavailable" } };
      return { data: single ? missing ? null : { id: "conversation-1", renter_id: "renter-1", landlord_id: "owner-1" } : [], error: null };
    }
    async single() { return this.result(true); }
    async maybeSingle() { return this.result(true); }
    then(resolve: (value: ReturnType<Query["result"]>) => unknown) { return Promise.resolve(this.result(false)).then(resolve); }
  }
  return { auth: { getUser: async () => ({ data: { user: { id: "renter-1" } }, error: null }) }, from: (table: string) => new Query(table) };
}
beforeEach(() => vi.clearAllMocks());
describe("Message read recovery", () => {
  it("does not render an inbox outage as an empty inbox", async () => {
    mocks.createClient.mockResolvedValue(client({ failingTable: "conversations" }));
    await expect(getConversations()).rejects.toThrow(/could not be loaded/i);
  });
  it("does not render a message outage as a new empty thread", async () => {
    mocks.createClient.mockResolvedValue(client({ failingTable: "messages" }));
    await expect(getMessages("conversation-1")).rejects.toThrow(/could not be loaded/i);
  });
  it("distinguishes a failed conversation lookup from an unavailable conversation", async () => {
    mocks.createClient.mockResolvedValue(client({ failingTable: "conversations" }));
    await expect(getConversation("conversation-1")).rejects.toThrow(/could not be loaded/i);
    await expect(getMessages("conversation-1")).rejects.toThrow(/could not be loaded/i);
  });
  it("keeps successful empty reads and inaccessible conversations private", async () => {
    mocks.createClient.mockResolvedValue(client({ missing: true }));
    expect(await getConversations()).toEqual([]);
    expect(await getMessages("foreign-conversation")).toEqual([]);
    expect(await getConversation("foreign-conversation")).toBeNull();
  });
});

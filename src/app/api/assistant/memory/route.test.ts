import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  deleteEq: vi.fn(),
  selectEq: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: (...args: unknown[]) => { mocks.selectEq(...args); return { maybeSingle: mocks.maybeSingle }; } }),
      upsert: (...args: unknown[]) => mocks.upsert(...args),
      delete: () => ({ eq: (...args: unknown[]) => mocks.deleteEq(...args) }),
    }),
  }),
}));

import { DELETE, GET, PUT } from "./route";

const USER = { id: "user-1" };

function put(body: unknown) {
  return new Request("http://localhost/api/assistant/memory", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
});

describe("/api/assistant/memory", () => {
  it("should_refuse_signed_out_visitors", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(new Request("http://localhost/api/assistant/memory"))).status).toBe(401);
    expect((await PUT(put({ memory: {} }))).status).toBe(401);
  });

  it("should_read_only_the_signed_in_persons_row_and_sanitise_it", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { memory: { version: 1, recent: [{ query: "type=room&evil=1", at: new Date().toISOString() }], preferences: ["quick:furnished", "bad"], declined: [] } },
      error: null,
    });
    const response = await GET(new Request("http://localhost/api/assistant/memory"));
    const payload = await response.json();
    expect(mocks.selectEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(payload.data.memory.recent[0].query).toBe("type=room");
    expect(payload.data.memory.preferences).toEqual(["quick:furnished"]);
  });

  it("should_return_empty_memory_when_there_is_no_row", async () => {
    const payload = await (await GET(new Request("http://localhost/api/assistant/memory"))).json();
    expect(payload.data.memory).toEqual({ version: 1, recent: [], preferences: [], declined: [], saved: [] });
  });

  it("should_say_it_failed_rather_than_return_empty_memory", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "down" } });
    expect((await GET(new Request("http://localhost/api/assistant/memory"))).status).toBe(503);
  });

  it("should_store_sanitised_memory_against_the_session_account", async () => {
    const response = await PUT(put({ memory: { version: 1, recent: [], preferences: ["quick:nsfas-approved", "mode:buy"], declined: [], saved: [] }, user_id: "someone-else" }));
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", memory: { version: 1, recent: [], preferences: ["quick:nsfas-approved"], declined: [], saved: [] } },
      { onConflict: "user_id" },
    );
  });

  it("should_delete_the_row_when_memory_becomes_empty", async () => {
    await PUT(put({ memory: { version: 1, recent: [], preferences: [], declined: [], saved: [] } }));
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("should_forget_everything", async () => {
    const response = await DELETE(new Request("http://localhost/api/assistant/memory", { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(mocks.deleteEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

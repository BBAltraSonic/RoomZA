import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  getUser: vi.fn(),
  interpretSearchWithAi: vi.fn(),
  getAssistantAiConfig: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.9",
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/features/assistant/ai-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/assistant/ai-search")>();
  return {
    ...actual,
    interpretSearchWithAi: (...args: unknown[]) => mocks.interpretSearchWithAi(...args),
    getAssistantAiConfig: () => mocks.getAssistantAiConfig(),
  };
});

import { POST } from "./route";

const empty = {
  english: true,
  mode: "unchanged",
  minPrice: null,
  maxPrice: null,
  beds: null,
  baths: null,
  propertyTypes: [],
  quickFilters: [],
  flags: [],
  place: null,
  unsupported: [],
};

function request(body: unknown) {
  return new Request("http://localhost/api/assistant/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.consumeRateLimit.mockResolvedValue({ success: true, remaining: 2 });
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.getAssistantAiConfig.mockReturnValue({ apiKey: "k", models: ["m"], dataCollection: "deny" });
  mocks.interpretSearchWithAi.mockResolvedValue({ ok: true, model: "m", result: { ...empty, maxPrice: 3000 } });
});

describe("POST /api/assistant/search", () => {
  it("should_answer_from_rules_without_ai_or_allowance_when_rules_understand_everything", async () => {
    const response = await POST(request({ text: "furnished room under R4000", current: "", deviceId: "device-123456" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.source).toBe("rules");
    expect(json.data.query).toContain("maxPrice=4000");
    expect(mocks.interpretSearchWithAi).not.toHaveBeenCalled();
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("should_strip_contact_details_before_the_ai_sees_the_text", async () => {
    await POST(request({ text: "quiet place, call 082 123 4567 or me@example.com", current: "", deviceId: "device-123456" }));
    const [input] = mocks.interpretSearchWithAi.mock.calls[0] as [{ text: string }];
    expect(input.text).not.toContain("082");
    expect(input.text).not.toContain("example.com");
  });

  it("should_merge_ai_chips_with_the_current_search", async () => {
    const response = await POST(request({ text: "something cosy", current: "type=room&area=Rondebosch&areaId=x", deviceId: "device-123456" }));
    const json = await response.json();
    expect(json.data.source).toBe("ai");
    const params = new URLSearchParams(json.data.query);
    expect(params.get("type")).toBe("room");
    expect(params.get("maxPrice")).toBe("3000");
    expect(params.get("area")).toBe("Rondebosch");
    const [input] = mocks.interpretSearchWithAi.mock.calls[0] as [{ currentChipLabels: string[] }];
    expect(input.currentChipLabels).toEqual(["Room", "In Rondebosch"]);
  });

  it("should_limit_guests_per_ip_and_per_device", async () => {
    await POST(request({ text: "something cosy", current: "", deviceId: "device-123456" }));
    const keys = mocks.consumeRateLimit.mock.calls.map(([options]) => (options as { key: string; requests: number }));
    expect(keys).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "assistant:global", requests: 18, window: "60 s" }),
      expect.objectContaining({ key: "assistant:guest-ip:203.0.113.9", requests: 3, window: "1 d" }),
      expect.objectContaining({ key: "assistant:guest-device:device-123456", requests: 3, window: "1 d" }),
    ]));
  });

  it("should_give_signed_in_people_a_larger_allowance_keyed_to_their_account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    await POST(request({ text: "something cosy", current: "", deviceId: "device-123456" }));
    const keys = mocks.consumeRateLimit.mock.calls.map(([options]) => (options as { key: string }).key);
    expect(keys).toContain("assistant:user:user-1");
    const userLimit = mocks.consumeRateLimit.mock.calls.find(([options]) => (options as { key: string }).key === "assistant:user:user-1");
    expect((userLimit?.[0] as { requests: number }).requests).toBe(10);
  });

  it("should_fall_back_to_rules_when_the_daily_allowance_is_used_up", async () => {
    mocks.consumeRateLimit.mockImplementation(async ({ key }: { key: string }) =>
      key.startsWith("assistant:guest-ip") ? { success: false, remaining: 0 } : { success: true, remaining: 1 });
    const response = await POST(request({ text: "cosy furnished room", current: "", deviceId: "device-123456" }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.data.source).toBe("rules");
    expect(json.data.notice).toBe("allowance_used");
    expect(json.data.query).toContain("quick=furnished");
    expect(mocks.interpretSearchWithAi).not.toHaveBeenCalled();
  });

  it("should_say_busy_when_the_shared_limit_is_hit", async () => {
    mocks.consumeRateLimit.mockImplementation(async ({ key }: { key: string }) =>
      key === "assistant:global" ? { success: false, remaining: 0 } : { success: true, remaining: 1 });
    const json = await (await POST(request({ text: "something cosy", current: "", deviceId: "device-123456" }))).json();
    expect(json.data.notice).toBe("busy");
  });

  it("should_fall_back_to_rules_when_ai_is_not_configured", async () => {
    mocks.getAssistantAiConfig.mockReturnValue(null);
    const json = await (await POST(request({ text: "something cosy", current: "", deviceId: "device-123456" }))).json();
    expect(json.data.notice).toBe("ai_unavailable");
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("should_answer_non_english_requests_without_ai", async () => {
    const json = await (await POST(request({ text: "Ek soek 'n kamer naby die kampus", current: "", deviceId: "device-123456" }))).json();
    expect(json.data.notEnglish).toBe(true);
    expect(mocks.interpretSearchWithAi).not.toHaveBeenCalled();
  });

  it("should_reject_invalid_bodies", async () => {
    const response = await POST(request({ text: "x".repeat(400), current: "", deviceId: "d" }));
    expect(response.status).toBe(422);
  });
});

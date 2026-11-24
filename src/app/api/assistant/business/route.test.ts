import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: null as unknown,
  consumeListerAi: vi.fn(),
  routeListerRequestWithAi: vi.fn(),
  buildViewFromData: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/assistant/business/business-allowance", () => ({ consumeListerAi: mocks.consumeListerAi }));
vi.mock("@/features/assistant/business/ai-lister", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/assistant/business/ai-lister")>()),
  routeListerRequestWithAi: mocks.routeListerRequestWithAi,
}));
vi.mock("@/features/assistant/business/business-view", () => ({ buildViewFromData: mocks.buildViewFromData }));
vi.mock("@/features/assistant/business/business-data", () => ({
  getListerContext: async () => mocks.context,
  loadListerData: async () => ({
    people: [{ key: "22222222-2222-4222-8222-000000000001:33333333-3333-4333-8333-000000000001", name: "Thandi Mokoena" }],
    listings: [{ id: "33333333-3333-4333-8333-000000000001", title: "Room in Bellville" }],
  }),
}));

import { POST } from "./route";

const AI_RESULT = { template: "people_list", stage: null, waitingOnYou: true, since: null, maxPrice: null, minPrice: null, change: null, percent: null, amount: null, reminderText: null, reminderDue: null };

function post(body: unknown) {
  return POST(new Request("http://localhost/api/assistant/business", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context = { userId: "me" };
  mocks.buildViewFromData.mockImplementation(async (request: { template: string }) => ({ template: request.template }));
  mocks.consumeListerAi.mockResolvedValue({ config: { apiKey: "k", models: ["m"], dataCollection: "deny" }, remaining: 19 });
});

describe("POST /api/assistant/business", () => {
  it("should_answer_from_the_rules_without_spending_the_allowance", async () => {
    const response = await post({ text: "what needs my attention today?" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ request: { template: "today" }, view: { template: "today" }, source: "rules" });
    expect(mocks.consumeListerAi).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("should_handle_a_named_person_locally", async () => {
    const body = await (await post({ text: "how is Thandi Mokoena doing" })).json();
    expect(body.data.request).toEqual({ template: "person_detail", personKey: "22222222-2222-4222-8222-000000000001:33333333-3333-4333-8333-000000000001" });
    expect(mocks.routeListerRequestWithAi).not.toHaveBeenCalled();
  });

  it("should_send_the_ai_only_masked_words_without_contact_details", async () => {
    mocks.routeListerRequestWithAi.mockResolvedValue({ ok: true, model: "m", result: AI_RESULT });
    // A surname alone isn't enough for the rules to pick the person, but it is still masked.
    const response = await post({ text: "has Mokoena (082 555 1234) been chasing me lately" });
    const body = await response.json();
    const sent = mocks.routeListerRequestWithAi.mock.calls[0]![0] as string;
    expect(sent).not.toMatch(/Thandi|Mokoena|082/);
    expect(sent).toContain("[person]");
    expect(body.data).toMatchObject({ request: { template: "people_list", filters: { waitingOnYou: true } }, source: "ai", remaining: 19 });
  });

  it("should_fall_back_to_today_when_the_allowance_is_used", async () => {
    mocks.consumeListerAi.mockResolvedValue({ config: null, notice: "allowance_used" });
    const body = await (await post({ text: "hmm something odd" })).json();
    expect(body.data).toMatchObject({ request: { template: "today" }, source: "rules", notice: "allowance_used" });
    expect(mocks.routeListerRequestWithAi).not.toHaveBeenCalled();
  });

  it("should_fall_back_to_today_when_the_ai_fails", async () => {
    mocks.routeListerRequestWithAi.mockResolvedValue({ ok: false, reason: "unavailable" });
    const body = await (await post({ text: "hmm something odd" })).json();
    expect(body.data).toMatchObject({ request: { template: "today" }, notice: "ai_unavailable" });
  });

  it("should_need_a_signed_in_lister_and_readable_text", async () => {
    expect((await post({ text: "" })).status).toBe(422);
    expect((await post({ text: "hi", extra: 1 })).status).toBe(422);
    mocks.context = null;
    expect((await post({ text: "what needs my attention" })).status).toBe(401);
  });
});

describe("POST /api/assistant/business notices", () => {
  it("should_not_report_a_routing_failure_when_only_the_writing_help_is_resting", async () => {
    mocks.consumeListerAi.mockResolvedValue({ config: null, notice: "ai_unavailable" });
    mocks.buildViewFromData.mockImplementation(async (request: { template: string }, _context: unknown, _data: unknown, options: { ai: () => Promise<unknown> }) => {
      await options.ai();
      return { template: request.template };
    });
    const body = await (await post({ text: "help me list a 2 bed apartment in Bellville" })).json();
    expect(body.data.request.template).toBe("new_listing");
    expect(body.data.notice).toBeUndefined();
  });
});

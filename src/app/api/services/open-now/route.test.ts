import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));

import { GET } from "./route";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: [A], error: null });
});

describe("GET /api/services/open-now", () => {
  it("should_return_the_services_that_are_open", async () => {
    const response = await GET(new Request(`http://localhost/api/services/open-now?ids=${A},${B}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ openIds: [A] });
    expect(mocks.rpc).toHaveBeenCalledWith("services_open_now", { service_ids: [A, B] });
  });

  it("should_reject_ids_that_are_not_uuids", async () => {
    const response = await GET(new Request("http://localhost/api/services/open-now?ids=nope"));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should_answer_empty_without_a_lookup_when_no_ids_are_given", async () => {
    const response = await GET(new Request("http://localhost/api/services/open-now?ids="));
    expect(await response.json()).toEqual({ openIds: [] });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("should_say_it_failed_instead_of_returning_an_empty_list", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const response = await GET(new Request(`http://localhost/api/services/open-now?ids=${A}`));
    expect(response.status).toBe(503);
  });
});

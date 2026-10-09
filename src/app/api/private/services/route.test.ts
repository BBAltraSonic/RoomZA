import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
const write = vi.hoisted(() => vi.fn());
vi.mock("@/features/services/data", () => ({ writeService: write }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/private/services", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => write.mockReset());
describe("private service mutations", () => {
  it("rejects foreign-origin and caller identity fields before reaching the session writer", async () => {
    expect(
      (
        await POST(
          request(
            { command: "create", id, expectedVersion: 0 },
            "https://foreign.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          request({ command: "create", id, expectedVersion: 0, poster_id: id }),
        )
      ).status,
    ).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });
  it("carries explicit permission confirmation and preserves a version conflict without retry", async () => {
    write.mockRejectedValue({ code: "PT409" });
    const response = await POST(
      request({
        command: "submit",
        id,
        expectedVersion: 3,
        permissionConfirmed: true,
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      command: "submit",
      id,
      expectedVersion: 3,
      permissionConfirmed: true,
    });
  });
  it("reports unavailable persistence as a failure", async () => {
    write.mockRejectedValue(new Error("offline"));
    expect(
      (await POST(request({ command: "create", id, expectedVersion: 0 })))
        .status,
    ).toBe(503);
  });
});

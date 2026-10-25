import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
const { write, read } = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn() }));
vi.mock("@/features/services/data", () => ({ writeService: write, readOwnedService: read }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/private/services", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => { write.mockReset(); read.mockReset(); });
describe("private service recovery reads", () => {
  const get = (target: string) => GET(new Request(`http://localhost:3000/api/private/services?id=${target}`));
  it("validates the target before calling the session-bound reader", async () => {
    expect((await get("invalid")).status).toBe(400);
    expect(read).not.toHaveBeenCalled();
  });
  it("returns only the session reader's owned result without caching", async () => {
    const item = { id, version: 4, status: "draft", draft: { title: "Fixture" } };
    read.mockResolvedValue(item);
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ item });
    expect(read).toHaveBeenCalledWith(id);
  });
  it("hides unavailable or foreign drafts and contains storage errors", async () => {
    read.mockResolvedValueOnce(null).mockRejectedValueOnce({ code: "42501" }).mockRejectedValueOnce(new Error("private failure detail"));
    const missing = await get(id);
    expect(missing.status).toBe(404); expect(await missing.json()).toEqual({ item: null });
    expect((await get(id)).status).toBe(403);
    const failed = await get(id);
    expect(failed.status).toBe(503); expect(JSON.stringify(await failed.json())).not.toContain("private failure detail");
    expect(failed.headers.get("cache-control")).toContain("no-store");
  });
  it("turns an account redirect into a safe private response", async () => {
    read.mockRejectedValue({ digest: "NEXT_REDIRECT;replace;/auth?redirect=%2Fpost%2Fservices;307;" });
    const response = await get(id);
    expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ nextPath: "/auth?redirect=%2Fpost%2Fservices" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
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

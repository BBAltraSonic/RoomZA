// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), query: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: mocks.client }));
import { usePurchaseProgress } from "./use-purchase-progress";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "buyer" } } });
  mocks.client.mockImplementation(() => {
    let id = "";
    const query = {
      select: () => query, abortSignal: () => query,
      eq: (key: string, value: string) => { mocks.eq(key,value); if(key === "listing_id") id=value; return query; },
      maybeSingle: () => mocks.query(id),
    };
    return { auth: { getUser: mocks.user }, from: () => query };
  });
});
afterEach(cleanup);
describe("sale progress reload and response ordering", () => {
  it("loads only the authenticated buyer's persisted stages", async () => {
    mocks.query.mockResolvedValue({ data: { completed_stages: ["sale_agreed", "sale_agreed"] }, error: null });
    const { result } = renderHook(() => usePurchaseProgress("sale",true));
    await waitFor(() => expect(result.current).toEqual(["sale_agreed"]));
    expect(mocks.eq).toHaveBeenCalledWith("user_id","buyer");
    expect(mocks.eq).toHaveBeenCalledWith("listing_id","sale");
  });
  it("does not query on public/guest or rental cards", () => {
    renderHook(() => usePurchaseProgress("sale",false));
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("ignores an old card's late response", async () => {
    let finishOld!: (value: unknown) => void;
    mocks.query.mockImplementation((id: string) => id === "old"
      ? new Promise(resolve => { finishOld=resolve; })
      : Promise.resolve({ data: { completed_stages: ["contacted_seller"] }, error: null }));
    const { result, rerender } = renderHook(({id}) => usePurchaseProgress(id,true), { initialProps: { id: "old" } });
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith("old"));
    rerender({id:"new"});
    await waitFor(() => expect(result.current).toEqual(["contacted_seller"]));
    await act(async () => finishOld({data:{completed_stages:["sale_agreed"]},error:null}));
    expect(result.current).toEqual(["contacted_seller"]);
  });
});

it("clears private stages at sign-out before any outstanding read settles", async () => {
  mocks.query.mockResolvedValue({data:{completed_stages:["sale_agreed"]},error:null});
  const {result} = renderHook(()=>usePurchaseProgress("sale",true));
  await waitFor(()=>expect(result.current).toEqual(["sale_agreed"]));
  mocks.user.mockResolvedValue({data:{user:null}});
  act(()=>window.dispatchEvent(new CustomEvent("pinpoint:account-identity",{detail:{userId:null}})));
  expect(result.current).toEqual([]);
});

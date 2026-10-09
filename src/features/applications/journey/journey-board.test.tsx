// @vitest-environment jsdom
import {act,cleanup,render} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({refresh:vi.fn(),remove:vi.fn(),callback:null as null|(()=>void)}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("./journey-card",()=>({JourneyCard:()=>null}));
vi.mock("@/lib/supabase/browser",()=>({createClient:()=>{const channel={on:(_event:string,_filter:unknown,callback:()=>void)=>{mocks.callback=callback;return channel;},subscribe:()=>channel};return{channel:()=>channel,removeChannel:mocks.remove};}}));
import {JourneyBoard} from "./journey-board";
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
it("keeps the trailing update in a burst and cancels disposed callbacks",()=>{
  vi.useFakeTimers();vi.setSystemTime(2000);
  const {unmount}=render(<JourneyBoard journeys={[]} renterId="renter"/>);
  act(()=>mocks.callback?.());expect(mocks.refresh).toHaveBeenCalledTimes(1);
  act(()=>{vi.advanceTimersByTime(100);mocks.callback?.();vi.advanceTimersByTime(400);mocks.callback?.();});
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  act(()=>vi.advanceTimersByTime(700));expect(mocks.refresh).toHaveBeenCalledTimes(2);
  act(()=>{vi.advanceTimersByTime(100);mocks.callback?.();});
  unmount();act(()=>{vi.advanceTimersByTime(2000);mocks.callback?.();});
  expect(mocks.refresh).toHaveBeenCalledTimes(2);expect(mocks.remove).toHaveBeenCalledTimes(1);
});

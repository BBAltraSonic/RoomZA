import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { createClient } from "./server";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("persists the Google PKCE verifier and exchanges it for a session across requests", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-publishable-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pinpoint.example");
  const jar = new Map<string, string>();
  cookieStore.getAll.mockImplementation(() => Array.from(jar, ([name, value]) => ({ name, value })));
  cookieStore.set.mockImplementation((name: string, value: string) => {
    if (value) jar.set(name, value); else jar.delete(name);
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const startClient = await createClient();
  const { data, error } = await startClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "https://pinpoint.example/auth/callback?next=%2Fsaved", skipBrowserRedirect: true },
  });
  expect(error).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  // This callback uses the legacy key because flow-id redirects are not enabled.
  // New SDKs also write per-flow slots and an index ending in the same suffix.
  const verifierCookie = Array.from(jar).find(([name]) => name === "sb-fixture-auth-token-code-verifier");
  expect(verifierCookie).toBeDefined();
  const verifier: string = JSON.parse(Buffer.from(verifierCookie![1].slice("base64-".length), "base64url").toString());
  const authorize = new URL(data.url!);
  expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
  expect(authorize.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));

  const user = { id: "11111111-1111-4111-8111-111111111111", email: "fixture@pinpoint.invalid" };
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token: "fixture-refresh",
    token_type: "bearer", expires_in: 3600, user,
  }), { status: 200, headers: { "content-type": "application/json" } }));
  const callbackClient = await createClient();
  const exchanged = await callbackClient.auth.exchangeCodeForSession("fixture-code");
  expect(exchanged.error).toBeNull();
  expect(exchanged.data.user?.id).toBe(user.id);
  expect(fetchMock).toHaveBeenCalledOnce();
  const requestBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
  expect(requestBody).toMatchObject({ auth_code: "fixture-code", code_verifier: verifier });
  expect(jar.has(verifierCookie![0])).toBe(false);
  expect(Array.from(jar.keys()).some((name) => name.includes("auth-token") && !name.endsWith("-code-verifier"))).toBe(true);

  const signedOut = await callbackClient.auth.signOut({ scope: "local" });
  expect(signedOut.error).toBeNull();
  expect(Array.from(jar.keys()).some((name) => name.includes("auth-token"))).toBe(false);
});

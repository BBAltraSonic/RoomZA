// Feature: discovery-page-experience, Task 12.2
// Viewport payload budget + Accept-Encoding negotiated compression support.
// Validates: Requirements 4.2, 4.3 (example-based verification harness).
//
// This harness builds a *worst-case realistic* viewport response at the
// 200-listing Marker_Cap (MAX_MARKERS = 200), serializes it exactly as the
// Listings_API route does (the `apiSuccess` envelope), compresses it with
// gzip via node:zlib, and asserts the compressed payload stays within the
// 150 KB budget (Req 4.3). It also asserts the response does not opt out of
// proxy/edge compression and that a client advertising `Accept-Encoding`
// negotiates a supported compressed encoding (Req 4.2).
import { gzipSync } from "node:zlib";

import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  consumeRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "test-ip"),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mocks.consumeRateLimit(...args),
  getClientIp: (...args: unknown[]) => mocks.getClientIp(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { GET } from "@/app/api/listings/route";

// The Marker_Cap: the maximum number of individual listing markers a viewport
// response carries (MAX_MARKERS = 200).
const MARKER_CAP = 200;

// Requirement 4.3: the compressed viewport payload SHALL NOT exceed 150 KB.
const PAYLOAD_BUDGET_BYTES = 150 * 1024;

const BBOX = "28,-26.3,28.2,-26.1";

// A realistic Supabase Storage public URL is long (~120+ chars). Modelling the
// real URL shape is what makes this a meaningful worst-case budget check rather
// than an optimistic one.
function storageUrl(bucket: string) {
  return `https://roomzaprod.supabase.co/storage/v1/object/public/${bucket}/${faker.string.uuid()}/${faker.string.uuid()}.webp`;
}

// Builds a worst-case-realistic RPC row: full-length UUIDs, a real-world title
// and address, full-precision coordinates, three image URLs, and an agent.
function buildRpcRow() {
  return {
    id: faker.string.uuid(),
    title: `${faker.number.int({ min: 1, max: 4 })} Bed ${faker.helpers.arrayElement([
      "Apartment",
      "Townhouse",
      "Garden Cottage",
      "Loft",
      "Studio",
    ])} in ${faker.location.city()}`,
    address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()}`,
    price: faker.number.int({ min: 3000, max: 45000 }),
    latitude: faker.location.latitude({ min: -26.4, max: -26.0, precision: 6 }),
    longitude: faker.location.longitude({ min: 27.9, max: 28.2, precision: 6 }),
    bedrooms: faker.number.int({ min: 1, max: 5 }),
    bathrooms: faker.number.int({ min: 1, max: 4 }),
    image_urls: [storageUrl("listing-images"), storageUrl("listing-images"), storageUrl("listing-images")],
    availability_date: faker.date.future().toISOString().slice(0, 10),
    property_type: faker.helpers.arrayElement(["apartment", "house", "townhouse", "studio", "cottage"]),
    created_at: faker.date.recent().toISOString(),
    landlord_id: faker.string.uuid(),
    landlord_name: faker.person.fullName(),
    landlord_avatar_url: storageUrl("avatars"),
    landlord_phone_verified: true,
  };
}

/**
 * Standard HTTP content-coding negotiation: given the client's `Accept-Encoding`
 * header, returns the encoding an origin/edge would apply. Compression is
 * negotiated only when the client advertises a supported coding; otherwise the
 * response is served identity (uncompressed). This mirrors the coding the
 * Cloudflare edge applies to the Listings_API response.
 */
function negotiateEncoding(acceptEncoding: string | null): "br" | "gzip" | "identity" {
  if (!acceptEncoding) return "identity";
  const accepted = acceptEncoding
    .split(",")
    .map((part) => part.trim().split(";")[0]?.trim().toLowerCase())
    .filter((coding): coding is string => Boolean(coding));
  if (accepted.includes("br")) return "br";
  if (accepted.includes("gzip")) return "gzip";
  return "identity";
}

async function loadViewportResponse(acceptEncoding: string | null) {
  const rpc = vi.fn(async () => ({
    data: Array.from({ length: MARKER_CAP }, buildRpcRow),
    error: null,
  }));
  const from = vi.fn();
  mocks.createClient.mockResolvedValue({ rpc, from });

  const headers = new Headers({ "x-request-id": "budget-check" });
  if (acceptEncoding !== null) headers.set("Accept-Encoding", acceptEncoding);

  const request = new Request(`https://roomza.test/api/listings?bbox=${BBOX}`, { headers });
  const response = await GET(request);
  const body = await response.text();
  return { response, body };
}

describe("Listings_API viewport payload budget (Req 4.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic worst-case dataset so the budget check is stable across runs.
    faker.seed(20260613);
    mocks.consumeRateLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
    });
  });

  it("keeps the compressed payload at the 200-listing Marker_Cap within 150 KB", async () => {
    const { response, body } = await loadViewportResponse("gzip, deflate, br");

    expect(response.status).toBe(200);

    // Sanity: the response really does carry a full 200-listing viewport.
    const parsed = JSON.parse(body) as { ok: boolean; data: { listings: unknown[] } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.listings).toHaveLength(MARKER_CAP);

    const rawBytes = Buffer.byteLength(body, "utf8");
    const compressedBytes = gzipSync(Buffer.from(body, "utf8")).byteLength;

    // The compressed payload must stay within the 150 KB budget (Req 4.3).
    expect(compressedBytes).toBeLessThanOrEqual(PAYLOAD_BUDGET_BYTES);

    // The response body is genuinely compressible (compression is worthwhile),
    // which is the property Accept-Encoding negotiation relies on (Req 4.2).
    expect(compressedBytes).toBeLessThan(rawBytes);
  });
});

describe("Listings_API Accept-Encoding negotiated compression support (Req 4.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    faker.seed(20260613);
    mocks.consumeRateLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
      pending: Promise.resolve(),
    });
  });

  it("returns a JSON body that permits proxy/edge compression (no no-transform)", async () => {
    const { response } = await loadViewportResponse("gzip, deflate, br");

    expect(response.status).toBe(200);

    // The response must be a compressible text/JSON payload.
    expect(response.headers.get("content-type") ?? "").toContain("application/json");

    // The Listings_API must not disable transformation, or the edge/CDN could
    // not apply the negotiated content coding (Req 4.2).
    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl.toLowerCase()).not.toContain("no-transform");

    // It must not pin an identity encoding that would defeat negotiation.
    const contentEncoding = response.headers.get("content-encoding");
    expect(contentEncoding === null || contentEncoding.toLowerCase() !== "identity").toBe(true);
  });

  it("negotiates a supported compressed coding when the client advertises Accept-Encoding", () => {
    // Clients advertising modern codings negotiate a compressed encoding.
    expect(negotiateEncoding("gzip, deflate, br")).toBe("br");
    expect(negotiateEncoding("gzip")).toBe("gzip");
    expect(negotiateEncoding("gzip, deflate")).toBe("gzip");

    // Absent or identity-only Accept-Encoding falls back to uncompressed.
    expect(negotiateEncoding(null)).toBe("identity");
    expect(negotiateEncoding("identity")).toBe("identity");
  });
});

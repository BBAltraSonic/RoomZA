import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

import { getListingsInViewport, getPublishedListingApiPayload } from "./api";

// The minimal viewport view-model fields required by Requirement 4.1: the
// fields consumed by the card and marker view models.
const REQUIRED_VIEWPORT_FIELDS = [
  "id",
  "title",
  "area",
  "price",
  "latitude",
  "longitude",
  "bedrooms",
  "bathrooms",
  "imageUrls",
  "availabilityDate",
  "created_at",
] as const;

// The projection intentionally also carries these client-consumed fields
// (the `type` filter and agent display). They are part of the controlled
// projection, not leaked raw DB columns.
const ADDITIONAL_PROJECTED_FIELDS = ["propertyType", "agent"] as const;

const ALL_PROJECTED_FIELDS = [...REQUIRED_VIEWPORT_FIELDS, ...ADDITIONAL_PROJECTED_FIELDS];

const bbox = { west: 28, south: -26.3, east: 28.2, north: -26.1 };

describe("mapListingRow (viewport projection via getListingsInViewport)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects only the controlled viewport view-model fields and drops raw DB columns", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          // Fields that belong in the projection.
          id: "listing-1",
          title: "Braam Studio",
          address: "Braamfontein",
          price: 7200,
          latitude: "-26.1930",
          longitude: "28.0341",
          bedrooms: "1",
          bathrooms: "1",
          image_urls: ["https://example.com/one.webp"],
          availability_date: "2026-08-01",
          property_type: "apartment",
          created_at: "2026-07-01T08:00:00.000Z",
          // Raw DB columns that MUST NOT leak into the minimal payload.
          status: "published",
          updated_at: "2026-07-02T00:00:00.000Z",
          metadata: { internal: true },
          description: "a long description that must never reach the wire",
        },
      ],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getListingsInViewport(bbox, {});

    expect("listings" in result).toBe(true);
    if (!("listings" in result)) return;

    const [listing] = result.listings!;
    expect(listing).toBeDefined();

    // The output keys are exactly the controlled projection - no raw DB leakage.
    expect(Object.keys(listing!).sort()).toEqual([...ALL_PROJECTED_FIELDS].sort());

    // Every required minimal viewport field is present.
    for (const field of REQUIRED_VIEWPORT_FIELDS) {
      expect(listing).toHaveProperty(field);
    }

    // Raw DB columns are absent.
    for (const leaked of ["status", "updated_at", "metadata", "description"]) {
      expect(listing).not.toHaveProperty(leaked);
    }

    // Values and coercions are correct.
    expect(listing).toMatchObject({
      id: "listing-1",
      title: "Braam Studio",
      area: "Braamfontein",
      price: 7200,
      latitude: -26.193,
      longitude: 28.0341,
      bedrooms: 1,
      bathrooms: 1,
      imageUrls: ["https://example.com/one.webp"],
      availabilityDate: "2026-08-01",
      propertyType: "apartment",
      created_at: "2026-07-01T08:00:00.000Z",
      agent: null,
    });
    expect(typeof listing!.latitude).toBe("number");
    expect(typeof listing!.longitude).toBe("number");
    expect(typeof listing!.bedrooms).toBe("number");
    expect(typeof listing!.bathrooms).toBe("number");
  });

  it("returns imageUrls: [] when a listing has no image (Req 4.5)", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "listing-no-image",
          title: "No Image Home",
          address: "Melville",
          price: 5000,
          latitude: "-26.17",
          longitude: "28.0",
          bedrooms: "2",
          bathrooms: "1",
          // No image_urls and no thumbnail_url.
          availability_date: null,
          property_type: null,
          created_at: "2026-07-01T08:00:00.000Z",
        },
      ],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getListingsInViewport(bbox, {});

    expect("listings" in result).toBe(true);
    if (!("listings" in result)) return;

    const [listing] = result.listings!;
    expect(listing!.imageUrls).toEqual([]);
    // The field is present rather than omitted.
    expect(listing).toHaveProperty("imageUrls");
  });

  it("falls back to thumbnail_url when image_urls is absent", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "listing-thumb",
          title: "Thumb Home",
          address: "Rosebank",
          price: 8000,
          latitude: "-26.14",
          longitude: "28.04",
          bedrooms: "1",
          bathrooms: "1",
          thumbnail_url: "https://example.com/thumb.webp",
          availability_date: null,
          property_type: null,
          created_at: "2026-07-01T08:00:00.000Z",
        },
      ],
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ rpc });

    const result = await getListingsInViewport(bbox, {});
    expect("listings" in result).toBe(true);
    if (!("listings" in result)) return;

    expect(result.listings![0]!.imageUrls).toEqual(["https://example.com/thumb.webp"]);
  });
});

describe("getPublishedListingApiPayload (detail payload)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildDetailClient(listing: Record<string, unknown> | null, images: unknown[] | null) {
    const listingsQuery = {
      select: vi.fn(() => listingsQuery),
      eq: vi.fn(() => listingsQuery),
      single: vi.fn(async () => ({
        data: listing,
        error: listing ? null : { message: "not found" },
      })),
    };

    const imagesQuery = {
      select: vi.fn(() => imagesQuery),
      eq: vi.fn(() => imagesQuery),
      order: vi.fn(async () => ({ data: images, error: null })),
    };

    const from = vi.fn((table: string) => (table === "listings" ? listingsQuery : imagesQuery));
    return { from };
  }

  it("includes the full detail fields required by the listing detail panel (Req 4.4)", async () => {
    const listing = {
      id: "listing-1",
      title: "Braam Studio",
      address: "Braamfontein",
      price: 7200,
      latitude: "-26.1930",
      longitude: "28.0341",
      bedrooms: "1",
      bathrooms: "1",
      parking_type: "street",
      parking_count: 1,
      electricity_type: "prepaid",
      water_availability: "municipal",
      property_type: "apartment",
      electricity_included: false,
      electricity_estimate: 400,
      water_included: true,
      water_estimate: 0,
      wifi_available: true,
      wifi_included: false,
      wifi_estimate: 500,
      parking_included: true,
      parking_estimate: 0,
      security_fee_estimate: 300,
      lease_duration: 12,
      availability_date: "2026-08-01",
      created_at: "2026-07-01T08:00:00.000Z",
      metadata: { amenities: ["pool"] },
    };
    const images = [
      { id: "img-1", public_url: "https://example.com/1.webp", sort_order: 0 },
      { id: "img-2", public_url: "https://example.com/2.webp", sort_order: 1 },
    ];

    mocks.createClient.mockResolvedValue(buildDetailClient(listing, images));

    const result = await getPublishedListingApiPayload("listing-1");

    expect("listing" in result).toBe(true);
    if (!("listing" in result)) return;

    // Full detail field set (a superset of the minimal viewport fields).
    const expectedDetailFields = [
      "id",
      "title",
      "address",
      "price",
      "latitude",
      "longitude",
      "bedrooms",
      "bathrooms",
      "parking_type",
      "parking_count",
      "electricity_type",
      "water_availability",
      "property_type",
      "electricity_included",
      "electricity_estimate",
      "water_included",
      "water_estimate",
      "wifi_available",
      "wifi_included",
      "wifi_estimate",
      "parking_included",
      "parking_estimate",
      "security_fee_estimate",
      "lease_duration",
      "availability_date",
      "created_at",
      "metadata",
      "images",
    ];
    for (const field of expectedDetailFields) {
      expect(result.listing).toHaveProperty(field);
    }

    // Coordinates are numeric-coerced and the images array is included in one response.
    expect(result.listing!.latitude).toBe(-26.193);
    expect(result.listing!.longitude).toBe(28.0341);
    expect(result.listing!.images).toEqual(images);
    expect(result.imagesLoaded).toBe(true);

    // Detail carries fields the viewport projection deliberately omits.
    expect(result.listing).toHaveProperty("electricity_estimate");
    expect(result.listing).toHaveProperty("lease_duration");
    expect(result.listing).toHaveProperty("metadata");
  });

  it("returns an empty images array (not null) and imagesLoaded=false when images fail to load", async () => {
    const listing = {
      id: "listing-2",
      title: "No Images",
      address: "Melville",
      price: 5000,
      latitude: "-26.17",
      longitude: "28.0",
      bedrooms: "2",
      bathrooms: "1",
      availability_date: null,
      created_at: "2026-07-01T08:00:00.000Z",
      metadata: null,
    };

    mocks.createClient.mockResolvedValue(buildDetailClient(listing, null));

    const result = await getPublishedListingApiPayload("listing-2");
    expect("listing" in result).toBe(true);
    if (!("listing" in result)) return;

    expect(result.listing!.images).toEqual([]);
    expect(result.imagesLoaded).toBe(false);
  });

  it("returns a not_found error when the listing is missing", async () => {
    mocks.createClient.mockResolvedValue(buildDetailClient(null, null));

    const result = await getPublishedListingApiPayload("missing");
    expect(result).toEqual({ error: "not_found" });
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/profile/actions", () => ({ setProfileRelationshipAction: vi.fn(), contactProfileAction: vi.fn() }));
vi.mock("@/features/admin/components/report-panel", () => ({ ReportPanel: () => <button type="button">Report</button> }));

import type { PublicProfile } from "@/features/profile/types";
import { ProfileSignInRequired, PublicProfileView } from "./public-profile-view";

const NOW = Date.parse("2026-11-22T10:00:00Z");

const base: PublicProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "thandi_homes",
  displayName: "Thandiwe Mokoena",
  avatarUrl: null,
  bio: "I manage garden cottages in Parkhurst.",
  languages: ["English", "isiZulu"],
  joinedAt: "2024-03-10T00:00:00Z",
  personas: ["landlord"],
  verificationBadges: ["phone", "identity"],
  reviewSummary: { publishedCount: 3, average: 4.7 },
  reviews: [
    { id: "r1", reviewerId: "a", subjectId: "b", overall: 5, body: "Upfront about every cost.", status: "published", verifiedInteraction: true, submittedAt: null, publishedAt: "2026-09-02T00:00:00Z", helpfulCount: 0 },
  ],
  responseStatistics: { medianFirstResponseSeconds: 840 },
  activeListings: [
    { id: "a1", title: "Garden cottage", address: "Parkhurst", price: 9800, bedrooms: 1, bathrooms: 1, listingType: "rent", imageUrl: null },
  ],
  catalogue: {
    status: "ready",
    specials: [
      { id: "e1", kind: "event", title: "Open house", venueName: "4th Avenue", address: "Parkhurst", priceCents: 0, originalPriceCents: null, startsAt: "2026-11-29T09:00:00Z", endsAt: "2026-11-29T13:00:00Z", state: "upcoming", imageUrl: null },
    ],
  },
  publicActivity: [],
  contact: { email: null, phone: null, canMessage: true },
  viewerState: { isOwner: false, isBlocked: false, isMuted: false },
  ownerView: null,
  searchIndexed: true,
};

afterEach(cleanup);

describe("PublicProfileView", () => {
  it("shows a lister's work in every category with links into discovery", () => {
    render(<PublicProfileView profile={base} signedIn now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "Thandiwe Mokoena" })).toBeInTheDocument();
    expect(screen.getByText("Identity verified")).toBeInTheDocument();
    expect(screen.getByText(/within about 14 min/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message Thandiwe/ })).toBeInTheDocument();

    const tabs = screen.getByRole("tablist", { name: /filter listings/i });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All2", "Homes1", "Specials1"]);
    expect(screen.getByRole("link", { name: /Garden cottage/ })).toHaveAttribute("href", "/?listingId=a1");
    expect(screen.getByRole("link", { name: /Open house/ })).toHaveAttribute("href", "/specials/e1");

    fireEvent.click(within(tabs).getByRole("tab", { name: /Specials/ }));
    expect(screen.queryByRole("link", { name: /Garden cottage/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open house/ })).toBeInTheDocument();
  });

  it("gives members who don't list a complete page without landlord-only stats", () => {
    const renter: PublicProfile = {
      ...base,
      personas: ["renter"],
      verificationBadges: [],
      reviewSummary: { publishedCount: 0, average: null },
      reviews: [],
      responseStatistics: { medianFirstResponseSeconds: null },
      activeListings: [],
      catalogue: { status: "ready", specials: [] },
    };
    render(<PublicProfileView profile={renter} signedIn now={NOW} />);
    expect(screen.queryByText(/Usually replies/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /listings/i })).not.toBeInTheDocument();
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
    expect(screen.getByText("After 3 reviews")).toBeInTheDocument();
  });

  it("never presents a failed catalogue read as an empty one", () => {
    render(
      <PublicProfileView
        profile={{ ...base, activeListings: [], catalogue: { status: "unavailable", specials: [] } }}
        signedIn
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/couldn.t load/i);
    expect(screen.getByRole("link", { name: /Try again/ })).toHaveAttribute("href", "/u/thandi_homes");
  });

  it("asks guests to sign in to message, and hides mute and block", () => {
    render(<PublicProfileView profile={{ ...base, contact: { ...base.contact, canMessage: false } }} signedIn={false} now={NOW} />);
    expect(screen.getByRole("link", { name: /Sign in to message/ })).toHaveAttribute(
      "href",
      `/auth?redirect=${encodeURIComponent("/u/thandi_homes")}`,
    );
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });

  it("says plainly when a signed-in member can't be messaged", () => {
    render(<PublicProfileView profile={{ ...base, contact: { ...base.contact, canMessage: false } }} signedIn now={NOW} />);
    expect(screen.getByText(/isn.t taking messages/)).toBeInTheDocument();
  });

  it("shows owners who can see the page and what is left to add", () => {
    const owner: PublicProfile = {
      ...base,
      bio: null,
      activeListings: [],
      catalogue: { status: "ready", specials: [] },
      viewerState: { isOwner: true, isBlocked: false, isMuted: false },
      contact: { email: "t@example.com", phone: null, canMessage: false },
      ownerView: { profileAudience: "members", reviewsVisible: true, activityVisible: false },
    };
    render(<PublicProfileView profile={owner} signedIn now={NOW} />);
    expect(screen.getByRole("heading", { name: "This is your public profile" })).toBeInTheDocument();
    expect(screen.getByText("Signed-in Pinpoint members")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Write a short bio/ })).toHaveAttribute("href", "/profile/edit");
    expect(screen.queryByRole("link", { name: /Verify your identity/ })).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Profile checklist" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("link", { name: /Edit profile/ })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("link", { name: /Create a listing/ })).toHaveAttribute("href", "/post");
    expect(screen.queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
  });
});

describe("ProfileSignInRequired", () => {
  it("returns the guest to the profile after signing in", () => {
    render(<ProfileSignInRequired username="sipho_n" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/auth?redirect=${encodeURIComponent("/u/sipho_n")}`,
    );
  });
});

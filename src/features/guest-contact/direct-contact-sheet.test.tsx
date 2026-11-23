// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DirectContactSheet, QuoteRequestButton } from "./direct-contact-sheet";

afterEach(cleanup);

const all = { phone: "+27215550100", whatsapp: "+27215550101", email: "help@example.com" };

describe("DirectContactSheet", () => {
  it("should open one sheet that lists every published channel, fastest reply first", () => {
    render(<DirectContactSheet contact={all} title="Tap repairs" name="Fixture plumber" />);

    fireEvent.click(screen.getByRole("button", { name: "Contact" }));

    expect(screen.getByRole("dialog", { name: "Contact Fixture plumber" })).toBeVisible();
    const channels = screen.getAllByRole("link").map(link => link.textContent);
    expect(channels[0]).toMatch(/^WhatsApp/);
    expect(channels[1]).toMatch(/^Call/);
    expect(channels[2]).toMatch(/^Email/);
    expect(screen.getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+27215550100");
    expect(screen.getByText("Fastest reply")).toBeVisible();
  });

  it("should skip the sheet when the lister published only one channel", () => {
    render(<DirectContactSheet contact={{ phone: all.phone }} title="Tap repairs" name="Fixture plumber" />);

    expect(screen.queryByRole("button", { name: "Contact" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Fixture plumber" })).toHaveAttribute("href", "tel:+27215550100");
  });

  it("should say plainly when there is no way to make contact", () => {
    render(<DirectContactSheet contact={null} title="Old listing" name="Venue" />);

    expect(screen.getByText("Contact details not provided")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should block contact while availability is being checked", () => {
    render(<DirectContactSheet contact={all} title="Tap repairs" name="Fixture plumber" disabled />);

    expect(screen.getByRole("button", { name: "Contact" })).toBeDisabled();
  });
});

describe("QuoteRequestButton", () => {
  it("should ask for a quote on WhatsApp when the provider uses it", () => {
    render(<QuoteRequestButton contact={all} title="Tap repairs" />);

    const link = screen.getByRole("link", { name: "Request a quote" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toContain("quote for Tap repairs");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should fall back to email, then a call, without inventing a channel", () => {
    const { rerender } = render(<QuoteRequestButton contact={{ email: all.email }} title="Tap repairs" />);
    expect(screen.getByRole("link", { name: "Request a quote" }).getAttribute("href")).toMatch(/^mailto:help%40example\.com\?subject=Quote/);

    rerender(<QuoteRequestButton contact={{ phone: all.phone }} title="Tap repairs" />);
    expect(screen.getByRole("link", { name: "Call for a quote" })).toHaveAttribute("href", "tel:+27215550100");

    rerender(<QuoteRequestButton contact={null} title="Tap repairs" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

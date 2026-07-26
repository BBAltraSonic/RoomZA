// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ApplicantAudienceTabs } from "./applicant-audience-tabs";

describe("ApplicantAudienceTabs", () => {
  it("switches between rental applicants and buyers with the active route exposed", () => {
    render(<ApplicantAudienceTabs active="buyers" />);

    expect(screen.getByRole("navigation", { name: "Applicant type" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rental applicants" })).toHaveAttribute(
      "href",
      "/dashboard/applicants",
    );
    expect(screen.getByRole("link", { name: "Buyers" })).toHaveAttribute(
      "href",
      "/dashboard/buyers",
    );
    expect(screen.getByRole("link", { name: "Buyers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

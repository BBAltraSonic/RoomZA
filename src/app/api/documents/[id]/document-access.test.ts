import { describe, expect, it } from "vitest";

import { resolveDocumentAccess } from "./document-access";

const base = {
    id: "doc-1",
    file_url: "renter-1/payslip.pdf",
    path: "renter-1/payslip.pdf",
    bucket: "application-documents",
    application_id: "app-1",
};

const renterId = "renter-1";
const landlordId = "landlord-1";

function row(overrides: Record<string, unknown> = {}) {
    return {
        ...base,
        application: {
            renter_id: renterId,
            listing: { landlord_id: landlordId },
        },
        ...overrides,
    };
}

describe("resolveDocumentAccess", () => {
    it("grants the renter on the application", () => {
        const access = resolveDocumentAccess(row(), renterId);
        expect(access).toEqual({ ok: true, bucket: "application-documents", path: "renter-1/payslip.pdf", role: "renter" });
    });

    it("grants the landlord on the listing", () => {
        const access = resolveDocumentAccess(row(), landlordId);
        expect(access.ok).toBe(true);
        expect(access.ok && access.role).toBe("landlord");
    });

    it("denies an unrelated user", () => {
        expect(resolveDocumentAccess(row(), "stranger-9")).toEqual({ ok: false, reason: "forbidden" });
    });

    it("denies an empty user id even if the row data is empty-stringy", () => {
        // Guards against a row whose ids are empty strings matching an empty user.
        const malicious = row({ application: { renter_id: "", listing: { landlord_id: "" } } });
        // empty landlord_id fails min(1) validation → malformed, not a silent grant.
        expect(resolveDocumentAccess(malicious, "")).toEqual({ ok: false, reason: "malformed" });
    });

    it("normalizes array-shaped to-one relations (Supabase join quirk)", () => {
        const arrayShaped = {
            ...base,
            application: [
                {
                    renter_id: renterId,
                    listing: [{ landlord_id: landlordId }],
                },
            ],
        };
        expect(resolveDocumentAccess(arrayShaped, landlordId).ok).toBe(true);
    });

    it("denies when the application is null (orphaned document)", () => {
        expect(resolveDocumentAccess(row({ application: null }), renterId)).toEqual({ ok: false, reason: "forbidden" });
    });

    it("falls back to the default bucket and file_url path", () => {
        const access = resolveDocumentAccess(row({ bucket: null, path: null }), renterId);
        expect(access).toMatchObject({ ok: true, bucket: "application-documents", path: "renter-1/payslip.pdf" });
    });

    it("treats a structurally invalid row as malformed, never a grant", () => {
        expect(resolveDocumentAccess({ nonsense: true }, renterId)).toEqual({ ok: false, reason: "malformed" });
        expect(resolveDocumentAccess(null, renterId)).toEqual({ ok: false, reason: "malformed" });
    });
});

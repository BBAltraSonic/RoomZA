# POPIA Controls

This is the technical baseline for POPIA readiness, not a legal certification.

- Store private renter documents in the private `application-documents` bucket only.
- Serve private documents through short-lived signed URLs after relation-based authorization.
- Log operational events with request IDs and redacted PII.
- Keep notification payloads minimal and avoid sensitive document data.
- Maintain restore drills and access reviews.
- Add retention/deletion workflows before public launch for expired applications and stale documents.

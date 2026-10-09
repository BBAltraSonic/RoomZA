# Shopping Offer intake contract — 30 September 2026

Product decision: **eligible signed-in accounts can become posters**, recorded from the user's answer on 30 September. Enrollment is explicit and independent of Property roles. For this first slice, eligible means a permanent, email-confirmed Auth account with a profile, a live session, no Auth ban or active account suspension, and no outstanding required policy reacceptance. Poster revocation is a separate server-managed restriction; enrolling again cannot undo it. These eligibility checks are implementation rules aligned with existing account gates, not additional product decisions about real supply.

## Additive data and access

| Record | Contract |
| --- | --- |
| `offer_posters` | Account-owned capability, enrollment time and optional revocation time. No organization scope or implicit Property persona grant. |
| `shopping_offers` | Owner, private draft, monotonically increasing mutation version, pending revision pointer and withdrawal time. No public/approved pointer in this intake slice. |
| `shopping_offer_revisions` | Immutable ID, offer, owner, content and submission time. Updates/deletes blocked by trigger, including privileged table clients. Review outcomes belong in append-only events. |
| `shopping_offer_events` | Append-only enrollment/create/save/submit/reject/withdraw/resubmit history, authenticated actor, database time, version, revision and correction reason. One event per successful transition; retries must not duplicate it. |

Authenticated clients have scoped SELECT only. Visitors have no table or function access. Writes go through public invoker RPCs calling explicitly granted functions in the unexposed `private` schema. The private functions need definer rights to read Auth/session/admin records and atomically write the protected tables; all identity comes from `auth.uid()` and the signed JWT/session, with an empty search path and fully qualified relations. Service keys do not supply an actor. Server adapters use the cookie/session client and existing `requireUser` / `requireAdmin`; no form controls ownership, account activity or review authority.

Owners read only their own drafts, revisions and events. Admins read submitted snapshots and audit history after current membership, account and MFA checks (aal2 plus one verified TOTP factor for admin, two for owner); private drafts remain owner-only. Ordinary posters cannot review. Rejection records reviewer/time/reason and clears the pending pointer; it never restores earlier content. Publication is deliberately absent.

Every mutation locks the offer row and compares the supplied expected version; authorization is rechecked after waiting for the lock. A successful create/save/submit/reject/withdraw increments the version and writes its event in the same transaction. A revision ID retries only its still-pending submission, without changing content or version; reuse after rejection/withdrawal fails. Concurrent writers using the same version must yield one winner and one conflict. Saving during review changes only the private draft. Withdrawal cancels the pending review through an event; a fresh revision is required to resubmit.

Submission validates the complete content in SQL, resolves the stored place UUID and checks the point against its bounds. The catalogue is trusted because existing server writes admit South African geocoder records; a bounding box alone does not prove geographic country membership or permission to publish. Synthetic local places test this relation only. Media and permission checks, real shop/address accuracy, approval, read-time public expiry, public projection and browser refresh remain later publication gates. The existing in-memory lifecycle model remains the specification for those later transitions.

## Verification boundary

Use an opt-in local harness with exact loopback URL and demo-key guards, no external requests, cleared delivery credentials, paused/restored database schedules, disposable accounts and a synthetic place. Verify real signed-in API/RLS reads and writes, direct-write denial, immutable history, MFA denial, account/poster revocation and simultaneous version conflicts. Capture IDs and before/after counts. Fixture-only deletion may temporarily bypass immutable triggers inside a guarded administrator transaction; normal APIs never get this cleanup power. Preserve existing data and all prior audit records.

This contract is one private persistence/access step. It does not complete the Shopping Offer journey, B1, Steps 1.2–1.4 or staging/production gates. Approval/public reads, organization editors, enrollment screens, reviewer screens and real supply require subsequent bounded steps.

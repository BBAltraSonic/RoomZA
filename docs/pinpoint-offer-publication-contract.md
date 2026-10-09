# Shopping Offer publication contract — 2 October 2026

Status: working implementation contract. The image-free path is agreed. Build selects the permission evidence separately, following the user's clarification to decide it separately from imagery. This contract does not grant permission for any actual shop, authorize publication or authorize contacting shops.

## Selected minimum permission evidence

At submission, the poster explicitly confirms: “I am authorized by this shop to publish this offer and its public address, and the benefit, terms and validity dates are accurate.” Store that confirmation separately against the exact immutable revision, with authenticated poster identity, database time and the confirmation text version. Enrollment and a populated draft are not permission evidence. Existing submitted revisions lacking this confirmation need a fresh permissioned submission before approval.

Before approval, the admin records supplied written authorization or an existing permissioned business record that establishes the poster's authority to publish for the shop. Shop-owned published information can corroborate the offer, address and dates, but public information alone does not establish that this poster has authorization. Record evidence type, source/reference, a concise verification note, reviewer and database time. A checkbox alone must not imply that an external fact was verified. Supplied evidence can be checked without sending messages or contacting shops. Evidence stays private; public content contains only the reviewed offer and public shop location. Actual operators and real evidence are still required before launch.

Images are unnecessary for this path. Do not insert a placeholder or scrape one. Any later image capability needs a separate ownership/license confirmation, storage ownership and reviewer check before publication; no media rights are inferred from shop permission.

## Separate approval gates

| Gate | Required check |
| --- | --- |
| Reviewer | Current active membership, account/session eligibility and real aal2, with one verified TOTP for admin or two for owner. Recheck after locking the offer. |
| Revision | Exact pending immutable revision and expected offer version; never publish private draft JSON. A stale request returns HTTP 409. |
| Poster | Current eligibility and non-revoked poster capability. Enrollment alone does not establish shop authorization. |
| Permission | Revision-specific poster confirmation plus the admin's recorded evidence check under the agreed minimum above. |
| Place provenance | Stored app-owned UUID from the validated South African catalogue; inspect its provider reference. A synthetic row or point inside bounds alone does not establish real provenance. |
| Shop and address | Inspect the shop identity, public address and exact shop point against the evidence; avoid substituting the place centre. |
| Content and dates | Complete benefit/terms, valid start/end offsets and future end. An approval before start can schedule eligibility; it must never extend expired content. |
| Public eligibility | Approved current revision, no new pending material edit, no withdrawal/unpublication/revocation/suspension, `startsAt <= now < endsAt`. Enforce on every read/action, independently of jobs. |

## Additive persistence proposal

Preserve the original offer schema, lifecycle, intake migration and functions. Add revision permission records, review evidence, approval/publication decisions and their immutable audit trail separately. No public grants on private evidence or draft tables. New session RPCs must derive the actor from Auth and retain existing revokes. Approval and publication invalidation must be atomic with intake transitions; any additive trigger must preserve the original write results/version contract and be tested under concurrency.

Saving a private draft leaves the confirmed snapshot unchanged. Submitting a material edit removes public eligibility immediately. Rejection cannot revive an earlier approval. Withdrawal or admin unpublication removes eligibility immediately; a fresh reviewed submission is needed to return. The public projection contains only the approved offer's public fields and stable offer ID, with status-safe old links. Public query/count/detail/action paths share one eligibility rule.

## Done when this later slice is verified

Use disposable, contained fixtures to prove rejection/conflicts and permission/media/provenance failures cannot publish, exact expiry works with paused jobs, pending edits stay hidden through direct links, withdrawal/unpublication remove actions, and approvals record the actor/revision/evidence atomically. Prove anonymous access only to the safe projection and retain private-table denial. Verify actual cookie MFA on a patched clone first, then the corrected shared runtime and staging separately. Real supplied content, staging access and separately authorized launch remain release gates.

# Owned offer publication status, next dependent slice

The existing workspace labels an approved offer with no pending revision as a private draft. The next additive slice must give posters a truthful publication summary without granting access to private admin evidence or decisions tables. It depends on the verified decision and public eligibility helpers. The session RPC and workspace implementation are now present; nine real clone RPC checks passed and cookie verification is in progress.

A bounded session RPC will derive ownership from the actual signed-in identity, validate current poster/session eligibility, and accept at most twenty distinct offer UUIDs. It will return current offer version, a checked-at clock, latest approval identity/date/window when relevant, and a minimal owned status. It will reject anonymous/service access, nonowners, revoked or suspended accounts and malformed batches. No reviewer identity, permission/location reference, verification note or internal removal reason will be returned.

| Current state | Workspace label |
| --- | --- |
| No approval history, no pending revision or later rejection | Private draft |
| Current pending revision | Awaiting admin confirmation |
| Current withdrawal | Withdrawn |
| Current approval, start still ahead | Confirmed, starts later |
| Current approval and eligible now | Live |
| Current approval past its end | Expired |
| Current approval but public gate fails | Confirmed, currently unavailable |
| Latest admin unpublication | Removed by admin |
| Earlier approval invalidated, or a rejection newer than the last decision | Needs fresh confirmation |

Workspace reads will attach the summary only when its current version matches the owned draft row. A changed version must require a fresh read, rather than merge inconsistent frames. A private save keeps the reviewed snapshot and its status. Material submit and withdrawal immediately take precedence. Server refreshes may update the status and history while preserving unsaved form text. If another actor advances the version, the form must show the change and require reloading before writing; expected-version enforcement remains in the original RPCs.

Done when real session/RPC/SQL checks and phone/desktop cookie workspace checks distinguish approval, private save, pending edit, unpublication, withdrawal and expiry, retain draft text on conflict, preserve private table revokes, and complete guarded fixture cleanup. Existing Property roles, links, saved homes and original offer intake/domain bytes stay unchanged. Shared runtime and staging remain separate gates.

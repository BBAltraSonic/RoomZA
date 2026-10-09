# Property organization access — 2 October 2026

Six real Auth/REST/RPC/SQL access groups passed on a disposable Postgres `17.6.1.113` clone. [Machine evidence](pinpoint-organization-access-local-evidence.json) records the six identities, captured fixture IDs, source hashes, security catalogue, persisted results and cleanup. This is partial Property Step 1.4 evidence; application cookie flows, private Storage/signed URLs, staging and production remain open.

The actors were organization A's owner, admin and agent; organization B's owner; an unrelated landlord; and a renter. Anonymous/renter organization creation was denied. Two authorized owners created their own organizations. Invitation acceptance checked the actual authenticated email; owners could invite admins, admins could invite agents, and an admin's attempted admin invitation produced no row. No invitation was sent to a real person.

Owners/admins saw their own tenant's membership records; the agent saw its own membership only. Foreign and unrelated users saw no private organization/office records. Agent self-escalation and foreign metadata changes produced no persisted change. Owner/admin draft reads passed; the agent had no access to the owner's draft. Organization membership did not expose private conversations/messages: only the two participants read them. An admin's permitted office update persisted.

Owner revocation persisted, and the agent's existing JWT immediately lost organization/office access without a token refresh. It remained unable to read or delete the draft. Direct listing UPDATE attempts were denied, including owner/admin requests, preserving existing table revokes.

## Functional gaps discovered

The existing `updateListing` application action uses the signed-in client, which cannot UPDATE `listings` under the preserved grants. The existing security-invoker `delete_listing_checked` RPC requires UPDATE privilege for its `FOR UPDATE` lock and therefore returns `42501`, including for the owner/admin. The access run verifies denial and unchanged data; it does **not** establish successful application listing edits/deletion. Those paths require separate repairs and real application checks. No privilege was granted to bypass the failure.

## Failed attempts retained separately

- [Catalogue comparison attempt](pinpoint-organization-catalog-failure-evidence.json): raw JSON hashing differed because object keys were emitted in another order. Exact structural comparison of definitions, ACLs, definer flags and settings replaced the ordering-sensitive assertion.
- [Draft-read attempt](pinpoint-organization-draft-read-failure-evidence.json): the harness incorrectly expected agent access to an owner's managed draft. The existing policy explicitly allows owner/admin; the expectation was corrected without changing permissions.
- [Direct-update attempt](pinpoint-organization-direct-update-failure-evidence.json): the harness incorrectly expected a permitted admin REST listing update. Existing table revokes correctly denied it.
- [Delete-RPC attempt](pinpoint-organization-delete-rpc-failure-evidence.json): five groups passed before the invoker row-lock operation returned `42501`. The final access run records this as a functional gap, not successful deletion.

All attempts removed their labelled clone resources and preserved the shared baseline. The successful run also removed all six captured Auth identities, both organizations and their memberships/offices/invitations, the private draft, conversation and message. Clone counts and Property fingerprints returned to baseline; shared counts, fingerprints, functions, RLS, grants and container configuration matched before/after. No crash marker was found.

The opt-in parent and task remain at `%TEMP%\pinpoint-org-access-clone.mjs` and `%TEMP%\pinpoint-org-access-check.mjs`; their hashes are recorded in the evidence. They use an internal-only Docker network, loopback gateway `55431`, verified local demo credentials, confirmed synthetic accounts with email delivery disabled, cron launch stopped and copied jobs inactive. There was no schema migration in this access run. It neither corrects the affected shared `.111` runtime nor explains the earlier unrelated restore crash. Release counts remain **2/48** and **0/3 journeys**.

# O06 owner lifecycle acceptance

O06 is locally accepted on 25 October 2026. The full audit remains unfinished: 17 checked / 131 unchecked, with hosted/provider/device and deferred private-document gates separate. The authoritative requirement audit is `artifacts/user-flow-property-owner-controls-o06-acceptance.json`.

| Requirement | Current evidence | Result and boundary |
| --- | --- | --- |
| Archive, filter to Archived and restore | Current six-milestone headed browser; current native buyer, rental and authorization groups | Real owner UI returns a draft while exact active buyer/rental records survive. An authorized organization admin also acts on another creator's listing in native proof. |
| Duplicate and ordinary delete | Same browser; native authorization group | Exactly one UI Duplicate creates one private editor/copy, no copied buyer history, and shared photo references. Cancel sends no mutation. Exactly one ordinary Delete removes the unencumbered copy while the original, its buyer/progress and three hash-verified photo objects survive. |
| Active buyer protection | Current native buyer group and current browser | Actual buyer/owner/seller actions preserve exact records at interested/negotiating/accepted. Held real seller transaction reopening an inactive enquiry returns a useful busy conflict, then commits without loss. Initial browser sale/enquiry/progress are explicit fixtures; actual buyer/seller actions are native proof. |
| Active rental protection | Current native rental group | Declared submitted/under_review/shortlisted/approved rows survive exact deletion refusal and archive/restore. No renter submission or private document is accessed or accepted. |
| Access and session boundaries | Current native authorization group; 11 lifecycle unit tests | Thirteen denials cover forged/mismatched/expired actual sessions, unrelated/current-agent authority, demoted/revoked membership, wrong active organization, removed organization, suspended owner, missing capability, and anonymous/authenticated direct RPC. Legitimate owner and organization-admin actions still work. |
| Incoming buyer races | Two current native transaction groups | Actual PostgreSQL lock waits are observed in both orders. A committed incoming enquiry causes owner deletion to fail and is reused by a real buyer action/progress. A held real owner delete causes a concurrent real buyer action to fail without orphan enquiry/progress. Transaction windows are explicit local fixtures; no hosted-concurrency claim. |
| Error recovery and keyboard access | Current headed browser compared with retained failed parent | Failure appears as an alert inside the dialog, controls are ready as soon as that failure arrives, and Cancel/Escape return focus and clear the message. Ordinary successful actions still wait for their transition; no automatic retry. |
| Responsive/theme/reduced motion | Current actual dialog measurements and inspected 390px images | Six measured CSS theme/width states: light/dark at 320/390/1280px, no horizontal overflow and reachable controls, reduced motion. Physical-device acceptance remains separate. |
| Runtime and preservation gates | Current native/browser raw reports, source/compiled proofs and frozen manifests | Native 6/0/87/93, browser 2/0/88/90; fresh build, both JS budgets, 1,026 matching application inputs, 756 executable compiled files unchanged, clean page/console, full role/default parity, advisors/original functions/no crashes, complete labelled service/helper/volume/network cleanup and unchanged source/shared data/configuration. Three later support differences are additive native test/selector/registration changes and are verified in the current native input set. |

Current passed parents:

- `artifacts/property-owner-controls-native-passed-20261025`: tag pinpoint-release-deadb492-a781-4621-ad17-b711ae3eb194; 1,213 records, six named native groups.
- `artifacts/property-sale-buyer-recovery-browser-passed-20261025`: tag pinpoint-release-9d57264a-12fc-4d39-8b14-ba4a935257ae; 2,469 records, six actual owner milestones.

Failed parents remain failed:

- `artifacts/property-sale-buyer-boundary-failed-20261025`: actual buyer data loss before protection, 1/1/87/89 and 1,311 records.
- `artifacts/property-sale-buyer-browser-failed-20261025`: actual disabled-trigger/focus failure, 1/1/88/90 and 2,464 records.

The acceptance verifier checked all 7,457 retained parent records. The initial protected native parent remains separately retained for provenance, but the final acceptance uses the complete current six-group native result.

The additive guard migration is local/unapplied to shared databases. G10 remains immutable at its accepted inputs; this current proof covers the later shared owner command/UI changes. G07 and all other unchecked journeys remain open. No deployment, shared migration, commit or push.

# Readiness and measurement

## Current operating state

Preparation. Advertising spend R0. No public campaign scheduled. The user will create the social profiles. No qualified enquiries, participating owners or live listing counts have been measured in this work; blank tracker inputs mean unmeasured, not zero.

## Required before promoting live rentals

| Gate | Pass evidence | Current result |
|---|---|---|
| Useful local supply | At least five distinct, current, normally approved listings in the same usable local area; owner and availability checks dated | Not tested |
| Mobile renter journey | Exact shared listing/area opens on a phone; details match the post; authorised owner-contact route works. Any external test message needs an agreed test recipient | Not tested |
| Owner journey | An authorised test owner submits through the existing draft, submission and review process; publication behaves correctly | Not tested |
| Campaign reporting | A tagged link reaches the intended destination and a test enquiry can be connected to its source without counting a click as an enquiry | Not tested |
| Media permissions | Each selected property asset has current organic permission; paid use has its separate permission if selected for an ad | Not tested |
| Campaign availability | Selected rooms rechecked on launch day; a named operator can pause content when taken | Not tested |
| Housing ad setup | Current South African account/country housing-ad requirements and permitted audience settings checked inside the actual ad account | Not tested |

The existing app contains area-alert capture and a listing-view event in local source. Neither proves successful production delivery or campaign conversion attribution. Test alerts, actual receipt and opt-out separately before promising them. There is no need to add a new waitlist or tracking pixel to publish preparation education.

## Campaign link convention

Use the actual shared property/area URL, without reconstructing location IDs or removing existing query parameters. Add:

- `utm_source`: facebook, instagram or tiktok.
- `utm_medium`: organic_social or paid_social.
- `utm_campaign`: wc_rooms_prelaunch_20261026, changing the suffix if Day 1 changes.
- `utm_content`: asset ID such as V01, or an approved group code such as G01.

`tools/campaign-link.mjs` accepts a verified URL and adds these tags while preserving the original path, query and fragment. It does not install attribution. Use platform outbound-click metrics for clicks. Record enquiry attribution only from a tested website source, an explicit source response or a clearly identified campaign conversation. Mark unknown sources Unknown. Record evidence type so self-reported source and directly observed source stay distinguishable.

## Definitions

- **Owner conversation:** a unique owner/business sends a substantive reply about participating. Invitations and unanswered follow-ups are not conversations. Count each owner once.
- **Participating owner:** authority, willingness to participate and required listing/media permission have been confirmed. This is not a verification badge or a guarantee.
- **Live listing:** a distinct, normally published listing, still available at the stated snapshot. A weekly inventory snapshot must not be summed across weeks.
- **Qualified renter enquiry:** a person identifies a matching Western Cape area and budget and requests owner contact or a viewing for an actual available room. A view, like, link click or general follow is not an enquiry.
- **Unique enquiry:** count the same person’s repeated enquiry about the same room once across channels, using a stable neutral deduplication key. A later enquiry about a different room is a separate enquiry, not a new unique person. Record test enquiries separately and exclude them.
- **Completed tenancy:** record only with explicit owner/renter confirmation. Do not infer a tenancy from an enquiry or viewing.

## Updating the workbook

The workbook contains a 30-day Calendar, Results, Owners and Enquiries. Amber cells are editable. Leave actuals blank until checked; enter a measured zero when appropriate. Owners and Enquiries use neutral IDs rather than names, phone numbers or documents. Keep any necessary correspondence and permission evidence separately and link it by reference.

In Results, enter weekly source-specific outbound clicks and spend from the platforms. Owner and enquiry counts come from their logs. Published post counts are unique original assets, not the sum of cross-posted copies. Enter weekly live listing snapshots separately. The cost per qualified enquiry uses matching attributed **paid** enquiry rows and actual paid spend. If paid attribution is missing, it remains unavailable; organic enquiries must not make paid acquisition appear effective.

## Future advertising test: R750 maximum

This is a prepared test specification, not an activated campaign:

1. Pass all required gates and verify the current month’s available budget. No paid creator fee is included.
2. Use one Facebook/Instagram campaign and one permitted local audience matching the concentration of actual supply. Choose the two organic creatives that generated relevant local actions, not simply the most views.
3. Use a Traffic objective to the tested exact listing/area destination. Select the currently supported delivery optimisation only after confirming account measurement capabilities. Do not present outbound clicks as completed enquiries.
4. Prepare ten days at a nominal R75/day, but initially schedule only a **R375 lifetime tranche** with a fixed end. Daily budgets alone are not a hard total-spend limit. Ensure account billing taxes/fees fit the R750 all-in ceiling and lower media limits if needed.
5. At the end of the first tranche, pause and reconcile real spend, destination status and attributable qualified enquiries. If no qualified paid enquiry is attributable, keep paused and diagnose the offer, destination and creative.
6. Release at most the remaining all-in budget only if the first tranche produced at least one attributable qualified enquiry and every readiness gate still passes. There is no automatic budget increase or second platform campaign.
7. Pause immediately if the destination breaks, the featured room is unavailable, permissions end, or costs cannot be reconciled. Recheck availability during the test.

At this scale the result is directional. A small number of enquiries does not establish a reliable acquisition cost or predict tenancies.

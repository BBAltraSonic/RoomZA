# Plan: fewer choices, clearer next steps

Date: 23 November 2026. Status: proposal only. No code has been changed.

## The problem in one paragraph

Pinpoint keeps adding a second or third way to do the same thing. Each feature brought its own
button, so many screens have no clear "next step". Some examples: there are four ways to start a
conversation from one listing. "Create listing" appears in up to four places on one screen. The
account menu repeats five of the six destinations already in the bottom dock. People don't read
menus. They scan for the one obvious action, and when they find three, they hesitate. This plan
removes the duplicates. It gives each screen one primary action and puts every rarer action in
exactly one predictable place.

## What I looked at

- Navigation: `src/components/navigation/*` (header, mobile dock, account menu, nav config).
- Listing detail: `src/features/map-discovery/listing-detail-panel.tsx`,
  `src/features/showings/connect-now-sheet.tsx`, `src/features/guest-contact/contact-actions.tsx`.
- Listing management: `src/features/marketplace/*`, `src/app/post/*`, `src/app/dashboard/page.tsx`.
- Profile and settings: `src/app/profile/page.tsx`, `src/features/profile/components/profile-shell.tsx`,
  `settings-shell.tsx`.
- Discovery: `pinpoint-header.tsx`, `filter-bar.tsx`, `desktop-filter-row.tsx`.
- The running app at desktop (1366px) and phone (375px) widths, signed in as `landlord01`. The local
  database was unreachable, so screens that need data (profile, dashboard, listing detail) were
  audited from the code rather than seen rendered.

## Audit: where the choices pile up

| Surface | What a person sees today | Duplicates |
| --- | --- | --- |
| Account menu (member) | 11 items: Create listing, Profile, Privacy and settings, Trust and safety, Explore, Saved, My listings, Messages, Notifications, Dark mode, Sign out | On phones, 5 of them (Create, Explore, Saved, Messages, Notifications) are already in the dock one thumb-width away |
| Account menu (guest) | Create listing, Sign in, Browse listings, Trust and safety, Dark mode | "Create listing" just sends a guest to sign-in, the same as "Sign in" |
| Rental detail, desktop panel | Save, Share, WhatsApp, Call, Email, "Connect with X" + Connect now, live-tour card, Message, Apply now, Report: **10 actions**. Connect now opens 7 more (Chat, Voice, Video, Right now, Within 15 min, Within 30 min, Later today) | 4 ways to start talking (Message, Chat, WhatsApp, Email); 2 ways to call (Call, Voice) |
| Rental detail, phone | Save, Share, WhatsApp, Call, Email, Message (icon), Connect, Apply now, Report (icon) | Same as above, squeezed into one row |
| "Create listing" entry points | Desktop header button, phone dock "+", account menu, profile page header, My listings page header, dashboard "New listing", dashboard empty state "Create quick draft" | On `/profile` at desktop width: header button, account menu and page button all show at once |
| My listings | `/post/listings` is a 5-category picker (Property, Services, Shopping Specials, Places, Events), even for someone with only property listings. Property opens `/dashboard`, which has its own Import, New listing, Applicants, Buyer enquiries, Viewings and "All my listings". That last link leads back to the picker | A loop: My listings → Property → All my listings → My listings |
| Profile overview | Create listing, Complete profile, View public profile, 6 count tiles (Applications, Purchases, Viewings, Messages, Notifications, Saved homes), Review verification, See all, plus an 8-item side menu: **about 19 choices** | The tiles repeat the dock (Messages, Notifications, Saved). The side menu repeats My listings. "Edit profile" and Settings → "Profile" are two homes for one task |
| Settings | 7 sections, separate from the 8-item profile menu | "Account settings" (profile menu) and "Privacy and settings" (account menu) are two names for one page |
| Discovery header (desktop) | Specials/Property/Services, location, search, Filters, Saved, Notifications, Create listing, avatar: 10 controls, then Rent/Buy and Sort in the panel | Saved and Notifications also live in the account menu |
| Filters | Type (6), Price, Beds, Baths, 4 toggles (Available now, Live video tours, Instant viewings, Replies under 5 minutes), plus quick chips (All homes, NSFAS, Furnished, Saved, New, Viewed) | "Saved" as a filter chip repeats the Saved tab |
| Naming | "Alerts" (dock) vs "Notifications" (menu, page); "Message" vs "Chat" vs "Contact seller"; "Create listing" vs "New listing" vs "Create quick draft"; "Saved" vs "Saved homes" | One action, several names, so it looks like several actions |
| Phone header on workspace pages | Bell in the top bar **and** in the dock | Two bells on one screen |

Dead code found in passing: `src/features/dashboard/workspace-nav.tsx` is not imported anywhere.

## Inspiration and the rules this plan follows

- **One primary action per screen.** Design systems agree on this. Visa and others warn that more than one
  primary button leaves people unsure what to do next ([Visa](https://design.visa.com/components/button/usage/),
  [Keystone](https://wcmauthorguide.pa.gov/en/keystone-design-system/design-system-components/Button.html),
  [Babich](https://babich.biz/blog/primary-secondary-action-buttons/)). Hick's law is the reason: every
  extra option adds decision time.
- **Zillow's listing page** leads with one decision: *Request a tour* or *Contact agent*. Scheduling
  happens only after that click, never as a wall of time slots up front
  ([Zillow touring](https://www.zillow.com/buy/touring/),
  [Zillow agents](https://www.zillow.com/agents/when-buyers-contact-premier-agent)).
- **Airbnb's listing page** has one sticky "Reserve" button. Share and Save sit as two quiet icons at the top.
  Report is in a link at the bottom. Its account menu holds account things, not a copy of the tab bar.
- **Apple HIG on tab bars**: use the minimum number of tabs, and don't hide destinations in overflow lists
  ([Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars.md)). Pinpoint's
  dock already does this. The account menu then undoes it by listing them again.
- Pinpoint's own `PRODUCT.md`: "focused, structured, frictionless" and "friction only where it improves
  lead quality".

From these, five rules for every change below:

1. **One primary action per screen.** At most one secondary. Everything else goes in an overflow (⋯) or lower on the page.
2. **Every destination has one home.** The dock or header owns navigation. The account menu owns account things only.
3. **Ask later, not up front.** Show a choice, such as a showing time or call type, after the person picks the
   action it belongs to.
4. **One name per action**, used everywhere.
5. **Hide what doesn't apply.** Hide empty categories, offline-only options and finished checklists instead
   of greying them out.

## The plan

Ordered by how much confusion each change removes for the effort. Each phase can ship as its own PR.

### Phase 1: remove the duplicates (small, low risk)

**1.1 Account menu holds account things only**
- Member menu becomes: identity header, **Profile**, **My listings**, **Settings**, (Admin console when
  allowed), **Help and safety**, **Dark mode**, **Sign out**. That is 7 items, down from 11.
- Remove Create listing, Explore, Saved, Messages and Notifications. The dock (phone) and header (desktop) already have them.
- Desktop discovery header: replace the lone Saved and bell icons with the same set as the dock (**Saved,
  Messages, Notifications**, each with its badge). Messages then never depends on the menu.
- Guest menu becomes: **Sign in or create account**, **Help and safety**, **Dark mode**. Drop "Create
  listing" and "Browse listings". A guest is already browsing.
- Files: `profile-menu.tsx`, `pinpoint-chrome.tsx`, `pinpoint-header.tsx`; tests in `profile-menu.test.tsx`,
  `navigation.test.tsx`, `pinpoint-header.test.tsx`.

**1.2 One "Create listing" per screen**
- Keep: the desktop header button and the phone dock "+". Remove it from the account menu (see 1.1) and from
  the profile overview header.
- On `/post/listings` the page's own button stays (it is the page's purpose), but hide the header's
  Create button on that route so the two don't sit side by side.
- Use one name everywhere: **Create listing**. Rename "New listing" and "Create quick draft".

**1.3 One name per action**
- "Alerts" → **Notifications** in the dock. "Saved homes" → **Saved**. "Privacy and settings" / "Account
  settings" → **Settings**. "Trust and safety" in menus → **Help and safety** (the page can keep its title).
- Hide the header bell on phones whenever the dock is showing.

**1.4 Clean-up**
- Delete the unused `src/features/dashboard/workspace-nav.tsx`.

### Phase 2: the listing detail action bar (highest impact on leads)

Today a renter faces up to 10 actions plus a 7-option popover. Target: **two buttons in the footer and
two icons in the header.**

- **Footer:** `[ Contact ]` (secondary) and `[ Apply now ]` (primary). For sale listings: `[ Contact ]` and
  `[ Request a viewing ]`.
- **Contact** opens one sheet, ordered by what Pinpoint wants first:
  1. **Message in Pinpoint** (recommended, kept on-platform, matching the anti-anonymous-chat principle)
  2. **Call now / Video now**: shown only while the landlord is online. Hidden, not greyed out, when offline.
  3. **Request a showing**: one row. Choosing it then asks *when* (now / 15 min / 30 min / later today).
  4. **WhatsApp · Call · Email**: the lister's public contact details, as one quiet row at the bottom
     and only when provided.
- **Header icons:** Save (heart) and **⋯**. The ⋯ menu holds Share and Report this listing.
- Live tour: keep as an informational card in the body when one is live or scheduled. It is not a button in
  the action bar.
- One shared component for desktop panel and phone, so they stop drifting (today `compact` gives each a
  different layout and set of buttons).
- Keep the existing `?intent=message` / `?intent=apply` deep links working. `message` opens the Contact sheet
  with Message focused.
- Files: `listing-detail-panel.tsx`, `connect-now-sheet.tsx` (becomes the Contact sheet),
  `contact-actions.tsx`; tests `listing-detail-panel.share.test.tsx`, `.trust.test.tsx`,
  `connect-now-sheet` tests, the `discovery-page.detail-*` tests, and the e2e flows.

### Phase 3: one place to manage your listings

- `/post/listings` shows **your listings in one list** (all categories), newest first. It has a category
  filter only when you have more than one category, and **Create listing** as the one primary action.
- Empty state (no listings yet): a single "Create your first listing" button that opens the category
  chooser.
- The category chooser (`/post`) stays as the first step of creating, the right place for that choice.
  If the person has listed before, put their last-used category first.
- Property-only tools (Applicants, Buyer enquiries, Viewings) move onto each property listing card as
  counts that link into that listing ("3 applicants →"). Remove the separate link row and the
  "All my listings" link that loops back.
- Import listings stays on the page for accounts that may import, as a secondary text link, not a second button.
- `/dashboard` redirects to `/post/listings?category=property`. Keep the old URL working.

### Phase 4: profile and settings

- **Profile overview**:
  - Primary action: **Complete profile** while below 100%. After that, no primary button, just the
    "View public profile" link.
  - Replace the 6 count tiles with a short **"Needs your attention"** list showing only items waiting on the
    person (for example "2 applications to review", "Viewing tomorrow at 14:00"). If nothing is waiting,
    show one calm line. Messages, Notifications and Saved live in the dock, not here.
  - Keep Verification and Recent activity, each with one link.
- **Profile side menu** (8 → 6): Overview, Edit profile, Verification, Documents, Reviews, Activity. Remove "My
  listings" (top-level nav owns it) and "Account settings" (account menu owns it).
- **Settings**: remove the "Profile" section and send `/settings/profile` to `/profile/edit`, so editing your
  profile has one home.

### Phase 5: discovery filters (measure first)

The discovery header is already one row and well structured, so change it only where it duplicates.
- Quick chips: keep at most four that change results (**NSFAS, Furnished, Available now, New**). Remove the
  "Saved" chip (the Saved tab owns it). Move "Viewed" to a "Recently viewed" row on the Saved page.
- Filters sheet: keep Type, Price, Beds and Baths open. Merge "Live video tours", "Instant viewings" and
  "Replies under 5 minutes" into one toggle, **"Responsive landlords"**, or a collapsed "More" group.
- Before shipping Phase 5, check usage data for each chip and toggle. Drop the least used, not the
  ones that seem least useful.

## Rough effort

| Phase | Size | Notes |
| --- | --- | --- |
| 1 | ~1 day | Mostly deletions and renames; update unit tests |
| 2 | 2–3 days | New Contact sheet; most test updates; e2e flows |
| 3 | 2–3 days | New combined list query across categories; redirects |
| 4 | 1–2 days | "Needs your attention" needs a small data function |
| 5 | ~1 day after data | Blocked on usage numbers |

## How we'll know it worked

- **Rule checks in tests (TDD):** for each surface, write the failing test first. Examples: the member
  account menu has ≤ 7 items and none of its hrefs match a dock destination; the listing action bar renders
  exactly one primary button; "Create listing" appears once per route; the dock label is "Notifications".
  Then make the change.
- **Lead quality:** compare the rate of applications and Pinpoint message threads per listing view before
  and after Phase 2. WhatsApp/email clicks should drop, and in-app messages should rise.
- **Quick usability check:** give five people two tasks, "contact this landlord" and "find the listing you
  posted", on a phone. Note hesitation and wrong taps, before and after.

## Decisions (confirmed 23 November 2026)

1. **Rentals: "Apply now" is the primary action.** Contact is the secondary button beside it.
2. **Voice and video calls stay.** They sit inside the Contact sheet and show only while the landlord is
   online. They are hidden, not greyed out, when the landlord is offline.
3. **WhatsApp, Call and Email stay as a quiet row** at the bottom of the Contact sheet, below Pinpoint
   messaging, and only when the lister provided them.
4. **`/dashboard` redirects** to `/post/listings?category=property`. Old links and bookmarks keep working.

Status: Phase 1 built on 23 November 2026 (not yet committed). One addition: the phone dock's
inactive icons are 4px narrower so "Notifications" fits whole at 375px. Below that width the
Notifications capsule shows only its icon rather than a cut-off word.

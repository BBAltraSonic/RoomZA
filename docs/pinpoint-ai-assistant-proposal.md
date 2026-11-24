# Proposal: Pinpoint Assistant

Date: 23 November 2026, updated 24 November 2026 (chat design added). Status: proposal only. No code has been changed.

## The idea in one paragraph

Pinpoint gets one assistant with two modes. Customers use it to find properties, specials, services
and events. Listers use it to run their business: see what needs attention, understand who is
interested, create better listings, see how listings perform and get tasks done. The assistant lives
in a side panel on desktop and a bottom sheet on phones. It answers with Pinpoint screens, not
paragraphs of text: the AI picks one of a fixed set of templates and fills in a few fields, and
Pinpoint loads the real data and draws the screen. **The AI never sees anyone's personal data and
never summarises anything.** It only reads the words a person has just typed, or a listing's public
details. AI is used for four jobs. Everything else is ordinary code, so the panel keeps working when
the AI is busy or the daily allowance is used up.

## Decisions already made

| Topic | Decision |
| --- | --- |
| Shape | One assistant, two modes: customer mode on the map and search pages, business mode on the dashboard |
| Where | Side panel on desktop, bottom sheet on phones. Almost everything happens inside it |
| Chat | A conversation thread: messages, cards, suggested replies and day/time pickers (see "Chat design") |
| Assistant's words | Fixed sentences written by Pinpoint for each template. The AI never writes chat messages |
| "Talk to a person" | Messages the landlord, seller or provider through existing flows, not Pinpoint support |
| Opens from | The dock button, and an *Ask* button on every listing, special and service |
| Chat history | Kept for the current visit only. Memory keeps chips, never the thread |
| How it answers | Custom-built templates. The AI picks a template and fills its fields. No A2UI in version one |
| Personal data | **The AI never sees it.** No messages, no profiles, no documents, no contact details, no records |
| Summaries | **None.** The AI does not summarise chats or anything else |
| Writing to customers | **Never.** No reply drafting of any kind |
| Lister types | Adapts to what the lister actually has (rooms, services, specials), not a business type they pick |
| Customer language | English only |
| Customer memory | Yes, remembered across visits. Kept by Pinpoint, never sent to the AI |
| Quick filters | Fixed per section, not chosen by the AI |
| Guests | Can use it with a small daily allowance. Signed-in users get more |
| Business memory | None. No stored lister preferences |
| Reminders | Shown in the panel only, not sent as notifications. Private to the person who set them |
| Background work | The panel updates on its own |
| Organisations | Members see the whole organisation's listings and people |
| AI provider | Free open models through OpenRouter, with the one-off $10 credit bought to raise the daily limit |

## Not in scope

- The AI reading messages, profiles, applications, documents or any other personal record.
- Summaries of chats, people or anything else.
- Drafting or sending messages to customers.
- Remembering a lister's preferences about people.
- The AI composing its own screens (A2UI). Can be revisited after version one.
- Languages other than English.
- Push or email notifications for assistant reminders.
- Chat messages written by the AI. Every line the assistant says is written by Pinpoint.
- Saved chat histories across visits.
- Pinpoint support staff in the chat.
- Any action that happens without the lister tapping Approve.

## The rules that keep it safe and simple

1. **The AI only sees two things:** the words a person has just typed into the panel, and a
   listing's public details when helping write or check that listing. Nothing else is ever sent.
2. **Personal details are removed before sending.** Phone numbers, email addresses and ID numbers
   are stripped from typed text. No account ID, name or memory is attached to a request.
3. **The lister's people are looked up by Pinpoint, not the AI.** If a lister types the name of
   someone who enquired ("what about Thandi?"), Pinpoint recognises it from the lister's own list
   and handles it without the AI. The name is never sent.
4. **The AI picks, Pinpoint checks.** The AI returns a template name and its fields. Pinpoint
   checks the template exists, the fields are allowed and the request stays within the person's own
   data. Anything that fails the check falls back to the starter chips.
5. **Facts come from the database, never from the AI.** Templates receive IDs and filters and load
   prices, listings, people and counts themselves.
6. **Only Approve changes anything.** Analysing runs freely. Preparing shows a preview of the
   change. Executing needs the lister to tap Approve, and runs Pinpoint's own server code with the
   lister's own permissions and organisation role.
7. **Decisions about a person are approved one at a time.** Declining a viewing, or rejecting or
   approving an application, is never one item in a bulk list. Low-stakes work (reminders,
   archiving, listing edits) can be approved together.
8. **Same permissions as the login.** The assistant reads data the same way the signed-in person's
   session does. No admin access and no SQL written by the AI.
9. **A count that fails to load says so.** It shows a note, never a zero. This rule already holds on
   the profile's "Needs your attention".
10. **Every AI feature has a version that works without AI.** If the AI is unavailable, chips,
    quick filters and templates still work.

## Customer mode

### How search works

Pinpoint's search already lives in the page address: rent or buy, price, beds, baths, property
type, area, map area, search text, sort, quick filter, and the specials and services categories.
The map and results already follow that address. **The customer AI has one job: turn what someone
types into a search address.** Every AI search can then be shared, reloaded and undone with Back.

### The flow

1. **Open.** Starter chips for the current section.
   - Rentals: Rooms near campus · NSFAS approved · Under R4,000 · Furnished
   - Specials: Food deals near me · Ending today · This weekend
   - Services: Plumber · Cleaner · Open now
   - Events: Tonight · This weekend · Free
2. **Ask.** Type, speak or tap: "Furnished room under R4,000 near UWC, NSFAS approved".
3. **Understood chips.** `Room ✕ · ≤ R4,000 ✕ · Near UWC ✕ · Furnished ✕ · NSFAS ✕`. The map moves
   and the pins and results update at the same moment.
4. **Refine.** Tap ✕, tap a quick filter, or ask "cheaper" or "closer", which adjusts the chips
   instead of starting again. Only the new words and the current chips are sent.
5. **Choose.** The panel shows the top 3 picks, each with a "why it matches" line built by Pinpoint
   from the chips. The full list stays in the main results pane.
6. **Act** using flows that already exist: compare, check a fact about a listing (or *Ask
   landlord*, which opens the Contact sheet), book a viewing from the landlord's viewing hours,
   save, or *Tell me when one comes up* (existing search alerts).

Comparing listings and listing facts are plain database lookups. No AI.

### Phone heights

- **Peek:** search box and active chips, with the map visible.
- **Half:** chips, quick filters and top picks.
- **Full:** compare, listing facts and memory.

### Honest gaps

When someone asks for something Pinpoint cannot filter on yet, the panel shows a grey chip, such as
**Pets: can't search this yet**, and never pretends. Counting those chips shows which filters to
build next. Known gaps today:

- Pets and Wi-Fi have no filter.
- Move-in date: listings have an availability date but there is no filter for it.
- "Near a campus" works through areas, places and the map area, not distance.
- Only one quick filter can be active at a time.

### Quick filters

Fixed per section. **Quick filters must allow several at once**, because people ask for
"furnished and NSFAS".

| Section | Has today | Proposed quick filters | New work |
| --- | --- | --- | --- |
| Rentals | Quick filters: NSFAS approved, Furnished, Recently listed, Favourites, Recently viewed (one at a time) | The same five, several at once | Multi-select |
| Specials: Shopping | Sorts only: Ending soon, Latest, Nearest | Ending today · New this week | Both filters (specials already have start and end dates) |
| Specials: Places | Sorts only: Ending soon, Latest, Nearest | New this week | The filter |
| Specials: Events | Sorts only. Events already know when they are on now | On now · Tonight · This weekend · Free | All four filters (dates, the on-now state and price already exist) |
| Services | A service-type dropdown (Plumbing, Electrical, Cleaning, Gardening, Handyman, Other) and sorts Latest, Nearest | The six service types as chips · Open now · Below nearby price | Open now (service hours already exist). Below nearby price (cards already show a "% below nearby" tag) |

"Near me" is not a quick filter. It is the existing *Nearest* sort.

### Memory

Memory is kept by Pinpoint and is **never sent to the AI**.

- **Stores chips, not what was typed.**
- **Recent searches** are saved automatically and drop off after about 90 days.
- **Preferences** are saved only after the person confirms ("Remember that you need
  NSFAS-approved?" → *Remember*). After that they apply by default as a removable chip.
- **On open:** "Welcome back. Room · ≤ R4,000 · Near UWC [Resume]. 2 new listings since Tuesday
  [Show]".
- **"What I remember"** lists everything with ✕ next to each item, plus *Forget everything*.
- **Guests** keep memory on their own device only. It moves to their account when they sign up.

### English only

A request in another language gets a plain "I can only help in English for now", and the starter
chips stay available.

## Business mode

### The idea

The business AI only turns what the lister types into the right template and filters. Pinpoint
then chooses which of the lister's records to show, and which existing action to offer next to
them. The AI never sees the records.

### Today (the opening screen)

```
4 enquiries waiting on you          [Open]
3 applications to review            [Open]
2 viewing requests to answer        [Open]
3 people ready for follow-up        [Open]
1 listing missing important info    [Fix]
Due today: follow up with 3 people who viewed but didn't apply   [Open]
⚠ Bookings couldn't load, try again
```

- Builds on the existing "Needs your attention" on the profile.
- Shows only what the lister has: landlords see enquiries, viewings and applications, service
  providers see booking requests, retailers see expiring specials.
- **No AI at all.** Counts, reminders and the badge are plain database queries.
- **Updates on its own** in the background.
- **Badge** on the assistant button when something needs attention or a reminder is due.
- **Reminders** appear here, with *Done* and *Snooze* (tomorrow, next week). They are not sent as
  notifications.

### The five capabilities

**1. Conversation intelligence, from activity rather than content.** "How are my enquiries this
week? Who's serious?" gives a count row (12 new · 5 serious · 3 waiting on you · 2 need follow-up)
and person cards. All of it comes from **what people did, not what they wrote**: who sent the last
message, how long since anyone replied, whether they booked a viewing, applied or went quiet. No
message is read by the AI and nothing is summarised.

*What people ask about* is optional and also has no AI. Pinpoint's own code checks incoming
enquiries for a fixed list of words (parking, pets, Wi-Fi, deposit, electricity, NSFAS, furnished,
move-in) and shows cards such as *Parking: mentioned in 3 enquiries, not on your listing* **[Add to
listing]**. Messages never leave Pinpoint.

**2. Potential customer management.** "Find everyone interested in rooms under R4,000" gives people
grouped by stage (Ready to apply · Viewing booked · Just enquired · Gone quiet), in priority order.
**Ranking uses visible reasons, never a hidden score:** Applied · Viewing booked · Budget fits ·
Move-in date fits · Profile complete · Verified. These are rules, not AI.

**3. Listing creation assistant.** "Help me list a two-bedroom apartment in Bellville" opens a form
with only the missing fields. The AI reads what the lister typed into fields, suggests a title and
description, turns features into chips and picks the category. A quality check flags gaps (no
photos, no move-in costs). A preview then goes through the existing publish flow and review. The
AI never adds photos or facts the lister didn't give, and never sees the lister's contact details.

**4. Business intelligence.** "How are my listings doing?" gives stat tiles (enquiries, viewings,
applications, typical reply time), a funnel per listing (views → enquiries → viewings →
applications), suggestion cards with one action each (*No viewing hours set* **[Set viewing
hours]**) and a comparison with similar listings nearby (price, photo count, completeness). All
plain queries and rules. No AI.

**5. Task execution.** The lister asks, the panel shows a change preview, and nothing happens until
Approve. Actions it can prepare, all existing Pinpoint actions:

- Accept or decline viewing requests, and propose times from the lister's viewing hours.
- Move applications along: review → shortlist → approve.
- Confirm or decline service bookings.
- Mark a listing as let and pause it, or change prices across listings.
- Apply an improved description or missing information.
- Renew an expiring special.
- Set reminders, and archive people who have gone quiet.

### Organisations

- Members see the whole organisation's listings, people and performance.
- What each member can **do** still follows their organisation role. Pinpoint has three roles:
  owner, admin and agent. Today the database only lets **owners and admins** act on organisation
  listings: viewing proposals, buyer interests, photos, move-in costs and the listing lifecycle.
- The assistant adds no permissions of its own and mirrors the database. Owners and admins see
  **Approve**. Agents see the same preview with Approve turned off and the note *"Needs an owner or
  admin"*.
- Managing members and invitations stays out of the assistant.
- Every approval records who approved it ("Viewing accepted by Sipho, 14:02"), shown on the person
  card so two members don't act on the same person twice.
- Reminders are private to whoever set them. Other members never see them.

## Chat design

Added 24 November 2026. The panel becomes a conversation. Each answer appears as a message or a card
in a thread, the next steps appear as replies the person can tap, and fixed buttons sit next to
the message box. The engine stays the same: the templates below become cards in the thread.

### Who writes what

- **Pinpoint writes every line the assistant says.** Each template has its own fixed sentences
  ("What would you like to know?", "The landlord shows this place on these days. Which suits
  you?"). The AI still only picks a template and fills its fields. It never writes chat messages.
- Facts in the thread come from the database. Because every answer is a listing fact or a database
  count, the thread does not need an "AI may be inaccurate" warning.

### Parts of the chat window

| Part | What it shows |
| --- | --- |
| Header | "Pinpoint Assistant", Beta tag, and what the chat is about underneath: a listing, the current search, a special or a service |
| Welcome card | One line on what it can do. On a return visit: "Welcome back" with *Resume* (from memory chips) |
| Assistant message | A fixed Pinpoint sentence, often with a card attached (listing card, top picks row, compare, change preview) |
| Person's message | What they typed or the reply they tapped |
| Suggested replies | Tap-able replies on the right. A fixed set per context, never chosen by the AI, like quick filters |
| Pickers | Day chips, then time chips, inside the thread. The chosen chip becomes the person's message |
| Pinned search card | On long chats, the current search chips stay at the top so they are always in reach |
| Buttons by the message box | Two fixed buttons per context (below) |

### "Talk to a person" means the lister

The fixed buttons connect to the lister, never to Pinpoint support:

| Chat about | Buttons |
| --- | --- |
| A rental or sale listing | *Message landlord* (or *Message the seller*) opens the existing Contact sheet · *Book a viewing* |
| A service | *Message provider* · *Book* (or *Ask for a quote* when the provider has no booking hours, as on the service page today) |
| A special | *Contact* (the existing direct contact sheet) · *Directions* |
| A search, or no item | None. Suggested replies only |

Pinpoint support, if ever needed, goes in the header's ⋯ menu, not in the thread.

### Where it opens

- **The dock button** opens a general chat about the current page (the current search on Explore).
- **An *Ask* button on every listing, special and service** (on its card and its detail view) opens
  a chat about that item, with its card as the first message.

### Conversations (customer mode)

1. **About one listing.** Suggested replies: *Still available?* · *Move-in costs* · *NSFAS
   approved?* · *Book a viewing* · *Similar places*. Answers come from the listing's own fields
   (the existing listing facts). When the listing doesn't say: "The listing doesn't mention
   parking." with *Ask the landlord*.
2. **Search.** What the person types becomes a message such as "Looking for: Room · ≤ R4,000 · Near
   UWC", with ✕ on each chip. Top picks show as a row of cards. Suggested replies: *Cheaper* ·
   *Closer* · *Furnished* · *Save this search*. The map and results follow the search address as
   they do now.
3. **Book a viewing.** Day chips, then time chips from the landlord's viewing hours
   (`getViewingAvailability`), then a summary card with *Send request* and *Change*. Sending calls
   the existing `requestScheduledShowing` with the listing and slot, so sign-in and double-booking
   rules are not copied. Guests see a *Sign in to book* card in the thread.
4. **Book a service.** The same steps using the provider's service hours, sent with the existing
   `requestServiceBooking`.
5. **Compare.** A *Compare these 2* card in the thread.

### Business mode in the same window

- Today is the first card. The starter questions are the suggested replies.
- Change previews are cards with *Approve*. Decisions about a person are still one card each.
- A viewing request card offers *Accept 14:00* or *Suggest another time*.
- Reminders are cards with *Done* and *Snooze*.
- No reply drafting. *Message* opens the inbox and nothing is written for the lister.

### The chat is not kept after the visit

- Memory stores chips, never what was typed, and a chat history is typed text. So **the thread
  lasts only for the current visit** (kept in session storage, cleared when the tab closes).
- Memory keeps working as it does now: recent searches, saved searches and confirmed preferences,
  as chips. *Welcome back* and *Resume* rebuild the search from chips, not the old thread.

### Phone and accessibility

- The three sheet heights stay. **Peek** shows the latest card and the message box. **Half** shows
  the recent thread. **Full** shows the whole thread.
- The thread is a live log (`role="log"`, polite announcements). Suggested replies and pickers are
  real buttons, at least 44 px tall.
- Voice input stays in the message box.

## Templates (version one)

The AI's whole job is to pick one of these 19 and fill in a few fields.

| Mode | Template | Shows |
| --- | --- | --- |
| Customer | Search results | Understood chips, quick filters, result count, map follows |
| Customer | Relax suggestion | "9 more if you go to R4,500 [Yes]" |
| Customer | Top picks | Up to 3 listing cards with a "why it matches" line |
| Customer | Compare | 2–3 listings side by side |
| Customer | Listing fact | One answer with its source, or *Ask landlord* |
| Customer | Save and alert | Save the search, tell me when one comes up |
| Customer | What I remember | Recent searches and preferences, with ✕ |
| Business | Today | Counts, reminders, links |
| Business | People list | Grouped, ranked person cards with reason tags |
| Business | Person detail | One person: stage, activity timeline, reason tags, next actions |
| Business | Question insights | Topics mentioned in enquiries, found by keyword rules, with *Add to listing* |
| Business | New listing form | Missing fields only, with suggested title and description |
| Business | Quality check | What's missing or weak on a listing |
| Business | Listing preview | The draft before publishing |
| Business | Performance | Stat tiles, funnel, comparison |
| Business | Suggestion | One recommendation, one action |
| Business | Change preview | What will change and for whom, then Approve |
| Business | Viewing slots | Times from the lister's viewing hours |
| Business | Reminders | Due and upcoming, with Done and Snooze |

The AI's answer is short and structured, for example:

```
template: people_list
filters:  max price R4,000 · this week · group by stage
```

## Where AI is used

Only these four jobs:

| Job | What the AI receives | What it returns |
| --- | --- | --- |
| 1. Customer search text → filters | The words just typed, plus the current chips | Filters |
| 2. Lister request → template | The words just typed, with people's names already handled by Pinpoint | A template name and its filters |
| 3. Listing writing | The listing's public details and what the lister typed about it | Fields, a title and a description |
| 4. Listing quality wording (optional) | The listing's public details | Short suggestions. Rules can do most of this |

For jobs 1 and 2, common phrases ("under R4,000", "furnished", "NSFAS", "waiting on me") are
recognised by simple rules first. The AI handles only what the rules can't.

Everything else is plain code: Today, counts, badge, reminders, background updates, activity-based
conversation insights, keyword topics, ranking and reason tags, stat tiles, funnel, comparisons,
suggestions, relax suggestions, quick filters, compare, listing facts, change previews, approvals
and customer memory.

## AI provider and limits

### Limits

- **Free open models through OpenRouter**, with the one-off $10 credit bought. Free models allow
  about 20 requests a minute, and about 1,000 a day once $10 has been bought (50 before). These
  numbers come from third-party write-ups. Confirm them on the OpenRouter account page after buying.
- **One limit for the whole of Pinpoint, not per user.** Per-user allowances share it out fairly.
  A starting point is **3 a day for guests, 10 for signed-in customers and 20 for listers**. Tune it
  from real use.
- **Only typed or spoken requests count.** Tapping chips, ✕, quick filters or *Yes* on a relax
  suggestion only changes the search address, and is free and unlimited.
- **Guests are limited per device and per IP address.**
- **About 20 a minute means bursts queue.** When busy, the panel says so and the chips keep
  working.

### Choosing models

The free list changes often. So the plan is a method as well as a first choice:

1. **Pin models per job, never the random free router.** OpenRouter's `openrouter/free` picks a
   random free model for each request, with uneven quality and a different data policy each time.
   Each job gets one main model and two fallbacks.
2. **Only models that support structured output.** Every job returns a short structured answer.
   Test it for real rather than trusting the label.
3. **A test set per job.** About 50 examples per job with the right answer, such as "furnished
   room under R4k near UWC" → the expected chips. Made-up examples only. Run every candidate against
   it, and run it again whenever a pinned model leaves the free list.

### Proposed model: NVIDIA Nemotron 3.5 Super VL

Checked against OpenRouter's model list on 24 November 2026.

| | Free (`nvidia/nemotron-3.5-super-vl:free`) | Paid (`nvidia/nemotron-3.5-super-vl`) |
| --- | --- | --- |
| Model | Open model, 120B total / 12B active (fast), reads text and images, 1M context | The same model |
| Structured output | Yes | Yes, on 9 of 11 providers |
| Who runs it | NVIDIA only, under the NVIDIA API Trial Terms | 11 providers, including DeepInfra, Together, Crusoe, Nebius |
| Data | Other free Nemotron endpoints say prompts and outputs are logged to improve NVIDIA's products. Assume the same here | Depends on the provider. Route only to non-training providers |
| Production use | The trial terms are reported to be for testing and evaluation, not production | Allowed |
| Price | Free | About $0.06–$0.15 per million tokens in, $0.35–$0.50 per million out |

- **Decision (24 November 2026): the free version is used for building, testing and production.**
- Test sets use made-up data only.
- **One model for all four jobs**, with fallbacks chosen by the test sets.
- **Known risk:** NVIDIA's trial terms are reported to be for testing, not production, and NVIDIA
  can change or withdraw the free endpoint. The paid version of the same model (roughly $10 a month
  at full volume) is the fallback if that happens. Switching is a change of model name, with no
  other work, because it is the same model.
- Its general benchmark scores are modest. That suits these short classification and writing jobs,
  but the test sets decide.
- Because the AI never sees personal data, the free version's logging matters much less.
- **Later idea, not version one:** it can read images, so the listing quality check could one day
  flag dark or blurry photos.

### Privacy by job

| Job | What is sent | Personal data | Rule |
| --- | --- | --- | --- |
| 1. Search text → filters | What a customer typed, with contact details stripped | None by design | No training. No account ID attached |
| 2. Request → template | What a lister typed, with contact details stripped and people's names handled by Pinpoint | None by design | No training. No account ID attached |
| 3. Listing writing | The listing's public details | None. Contact details and documents are never sent | No training |
| 4. Quality wording | The listing's public details | None | No training |

- Turn off training for free models in the OpenRouter account settings, and also restrict it on
  every request, so the account setting isn't the only protection.
- One write-up says data-policy routing is a paid-plan feature. Check the account settings after
  buying the credit.

### When models fail

Free models can be busy or withdrawn. Each job tries its main model, then the two fallbacks, then
falls back to templates without AI.

## What needs building first (no AI)

| Gap | Why it matters |
| --- | --- |
| One list of everyone who showed interest (enquiries, viewing requests, applications, bookings, buyer interests) | Capabilities 1, 2 and 5 depend on it |
| "Waiting on you": the customer sent the last message | Today and conversation intelligence |
| Recording listing views | The start of the performance funnel |
| Several quick filters at once | Customer requests often combine two |
| New quick filters: Ending today, New this week, On now, Tonight, This weekend, Free, Open now, Below nearby price | Specials, events and services have sorts but no quick filters today |
| Removing contact details from typed text, and recognising the lister's people by name | Keeps personal data away from the AI |
| Panel shell: side panel, bottom sheet with three heights, template renderer, badge | Everything sits in it |
| Panel reminders with Done and Snooze | Today screen |

## Build order

1. **Foundations, no AI.** The gaps above, the Today screen, reminders, background updates,
   activity-based conversation insights, ranking with reason tags, change preview and Approve for
   existing actions. Useful to listers on its own.
2. **Customer mode.** Rules-first text to filters, AI fallback, understood chips, grey chips for
   gaps, top picks, compare, listing facts, memory, allowances, alerts.
3. **Business mode.** Request to template, keyword topics, listing creation assistant and quality
   check.
4. **Performance.** Funnel, suggestions and comparisons, once listing views have collected enough
   data to be meaningful.

### Chat design build order

Steps 1 to 3 above are built. The chat design is built after them, one step at a time, tests first.
No new AI is needed for any of it.

1. **Chat window.** Thread, messages, suggested replies, buttons by the message box, pinned search
   card, the three sheet heights, and the thread kept for the visit only. The existing customer
   templates move into cards in the thread. Tests: the thread is a live log, replies are buttons,
   nothing typed is saved after the visit.
2. **Listing chat.** The *Ask* button on listings, the listing card as the first message, answers
   from listing facts, *Message landlord* through the Contact sheet.
3. **Booking in the chat.** Viewings first (day and time chips, summary card,
   `requestScheduledShowing`), then services (`requestServiceBooking`). Tests: choosing a slot sends
   the right listing and time, guests see the sign-in card.
4. **Search chat.** The chips message, the top picks row and the refine replies.
5. **Business mode in the chat window.** Today as the first card, starters as replies, change
   previews and reminders as cards.
6. **Specials and services.** The *Ask* button and their fixed buttons.

## Privacy (POPIA)

- The AI never receives messages, profiles, applications, documents, contact details, account IDs
  or memory.
- Typed text has phone numbers, email addresses and ID numbers removed before it is sent.
- No provider that trains on prompts is used.
- Customer memory has *What I remember* and *Forget everything*.
- Guest memory stays on the device.
- The privacy policy should still say that typed requests are processed by an AI provider to work
  out what the person is looking for.

## Open questions

Settled on 24 November 2026: reminders are private, the $10 credit will be bought, quick filters
per section are listed above, Approve follows the existing owner and admin rules, the AI sees no
personal data and makes no summaries, and the free Nemotron 3.5 Super VL runs in production, with
the paid version as the fallback.

Still open:

1. **Agents.** Should agents be able to approve anything, such as accepting viewings? Today the
   database says no, and the assistant follows that. Changing it would be a separate decision.
2. **Agents' read access.** Check that agents can already read the organisation's enquiries,
   applications and bookings, since every member is meant to see the whole organisation.

-- Pinpoint Assistant: draft policy wording for counsel review (proposal, "Privacy (POPIA)": the
-- privacy policy should say typed requests are processed by an AI provider).
--
-- Adds a new DRAFT version of the Privacy Policy and the AI Policy. Nothing is published:
-- trust_document_versions only allows approved or published versions after external review,
-- so these go through the existing review, approval and publish steps in the admin.
-- Each draft builds on the document's current published text (or its latest version), takes
-- the next version number, and is skipped if an assistant draft already exists.

with assistant_sections(slug, section) as (values
  ('privacy', $section$

## Pinpoint Assistant

When you type or speak a request to the Pinpoint Assistant, the words are sent to an AI provider (OpenRouter, which passes them to the model Pinpoint has chosen) to work out what you are looking for or which screen to show. Before anything is sent, Pinpoint removes phone numbers, email addresses and ID numbers, and replaces the names of people a lister deals with. Tapping chips, buttons and filters does not use AI.

Pinpoint never sends the AI your messages, profile, applications, documents, contact details, account ID, or what the assistant remembers about you. When a lister asks for help writing a listing, only the listing's public details and what the lister typed about it are sent, with contact details removed.

Pinpoint asks providers not to store or train on these requests where the provider offers that choice. Some models run under their provider's own terms and may log requests, which is why personal information is removed first.

Signed-in customers' recent and saved searches and confirmed preferences are kept in their account so the assistant can remember them; guests' stay on their device. Both can be reviewed and removed under "What I remember".

A lister's reminders are visible only to the person who set them. When a lister approves an action through the assistant, such as accepting a viewing, Pinpoint records who approved it and when, and members of the lister's organisation can see that record.

Voice input uses your browser's own speech recognition. Depending on your browser, the audio may be sent to the browser's maker to turn it into text. Pinpoint receives only the text.
$section$),
  ('ai-policy', $section$

## Pinpoint Assistant

The Pinpoint Assistant uses AI for narrow jobs only: turning what a customer typed into search filters, choosing which screen answers what a lister typed, and suggesting listing wording from details the lister gave. Everything else, including counts, rankings, reasons, comparisons and reminders, uses documented product rules.

The AI does not decide who can rent or buy, does not rank or judge people, and never acts on its own. Every change it helps prepare is shown as a preview and happens only when a person taps Approve; decisions about a person are approved one at a time. Listing wording it suggests is checked so it cannot add prices, sizes or other facts the lister did not give.

The AI receives only the words typed, with contact details and people's names removed, or a listing's public details. It never receives messages, profiles, applications, documents or account IDs, and it does not summarise conversations.
$section$)
),
targets as (
  select d.id as document_id, s.section,
    coalesce(
      (select v.body_markdown from public.trust_document_versions v where v.id = d.current_version_id),
      (select v.body_markdown from public.trust_document_versions v where v.document_id = d.id order by v.version desc limit 1),
      ''
    ) as base,
    coalesce((select max(v.version) from public.trust_document_versions v where v.document_id = d.id), 0) + 1 as next_version
  from assistant_sections s
  join public.trust_documents d on d.slug = s.slug
  where not exists (
    select 1 from public.trust_document_versions v
    where v.document_id = d.id and v.change_summary like 'Pinpoint Assistant disclosure%'
  )
)
insert into public.trust_document_versions(document_id, version, status, body_markdown, change_summary, requires_reacceptance)
select document_id, next_version, 'draft', btrim(base || section), 'Pinpoint Assistant disclosure: draft for counsel review.', false
from targets
on conflict (document_id, version) do nothing;

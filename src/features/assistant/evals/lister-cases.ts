import type { BusinessTemplate } from "../business/request-intent";

/**
 * Test set for AI job 2: lister request -> template and filters. Made-up requests only.
 * `[person]` is how a named person reaches the AI after Pinpoint masks it. `rules: true`
 * marks requests the rules must place on their own.
 */

export type ListerCase = {
  text: string;
  template: BusinessTemplate;
  /** Fields that must match, e.g. { stage: "gone-quiet" } or { change: "change_price", percent: 5 }. */
  expect?: Record<string, string | number | boolean>;
  rules?: boolean;
};

export const LISTER_CASES: ListerCase[] = [
  { text: "What needs my attention today?", template: "today", rules: true },
  { text: "what's waiting", template: "today", rules: true },
  { text: "who's waiting on me", template: "people_list", expect: { waitingOnYou: true }, rules: true },
  { text: "How are my enquiries this week? Who's serious?", template: "people_list", expect: { since: "week" }, rules: true },
  { text: "Find everyone interested in rooms under R4,000", template: "people_list", expect: { maxPrice: 4000 }, rules: true },
  { text: "who has gone quiet", template: "people_list", expect: { stage: "gone-quiet" }, rules: true },
  { text: "show me applicants", template: "people_list", expect: { stage: "applied" }, rules: true },
  { text: "new leads this month", template: "people_list", expect: { stage: "just-enquired", since: "month" }, rules: true },
  { text: "who needs a reply", template: "people_list", expect: { waitingOnYou: true }, rules: true },
  { text: "what are people asking about", template: "question_insights", rules: true },
  { text: "what questions do I get", template: "question_insights", rules: true },
  { text: "Help me list a two-bedroom apartment in Bellville", template: "new_listing", rules: true },
  { text: "create a new listing", template: "new_listing", rules: true },
  { text: "what's missing on my listings", template: "quality_check", rules: true },
  { text: "check my listing", template: "quality_check", rules: true },
  { text: "How are my listings doing?", template: "performance", rules: true },
  { text: "how many views did I get", template: "performance", rules: true },
  { text: "accept all viewing requests", template: "change_preview", expect: { change: "accept_viewings" }, rules: true },
  { text: "review new applications", template: "change_preview", expect: { change: "review_applications" }, rules: true },
  { text: "archive people who've gone quiet", template: "change_preview", expect: { change: "archive_quiet" }, rules: true },
  { text: "raise prices by 5%", template: "change_preview", expect: { change: "change_price", percent: 5 }, rules: true },
  { text: "lower the rent by 10%", template: "change_preview", expect: { change: "change_price", percent: -10 }, rules: true },
  { text: "remind me to call the plumber tomorrow", template: "reminders", expect: { reminderDue: "tomorrow" }, rules: true },
  { text: "my reminders", template: "reminders", rules: true },
  { text: "propose times", template: "viewing_slots", rules: true },

  // For the AI: wording the rules don't place.
  { text: "anything urgent?", template: "today" },
  { text: "give me the rundown for this morning", template: "today" },
  { text: "who's actually keen on the Rondebosch flat", template: "people_list" },
  { text: "which students went silent after viewing", template: "people_list", expect: { stage: "gone-quiet" } },
  { text: "list the folks who booked to come see the place", template: "people_list", expect: { stage: "viewing-booked" } },
  { text: "people who looked at cheap rooms, under three and a half grand", template: "people_list", expect: { maxPrice: 3500 } },
  { text: "who did I forget to answer", template: "people_list", expect: { waitingOnYou: true } },
  { text: "what does everyone keep wanting to know", template: "question_insights" },
  { text: "do tenants care about parking", template: "question_insights" },
  { text: "I've got a new cottage to put up", template: "new_listing" },
  { text: "write up my granny flat for me", template: "new_listing" },
  { text: "is my ad any good", template: "quality_check" },
  { text: "why is nobody contacting me about the Bellville room", template: "performance" },
  { text: "am I getting traffic", template: "performance" },
  { text: "say yes to everyone who wants to come view", template: "change_preview", expect: { change: "accept_viewings" } },
  { text: "the room got taken, take it down", template: "change_preview", expect: { change: "mark_let" } },
  { text: "bump everything up five percent for January", template: "change_preview", expect: { change: "change_price", percent: 5 } },
  { text: "drop the Rondebosch flat to 7200", template: "change_preview", expect: { change: "change_price", amount: 7200 } },
  { text: "clear out the dead leads", template: "change_preview", expect: { change: "archive_quiet" } },
  { text: "don't let me forget to fix the geyser on friday", template: "reminders", expect: { reminderDue: "friday" } },
  { text: "ping me next week about [person]'s deposit", template: "reminders", expect: { reminderDue: "next-week" } },
  { text: "when can I show [person] around", template: "viewing_slots" },
  { text: "which of my places is underperforming", template: "performance" },
  { text: "start applications moving for the room", template: "change_preview", expect: { change: "review_applications" } },
  { text: "who should I call first", template: "people_list" },
];

/**
 * Removes contact details from text before it can leave Pinpoint (proposal rule 2).
 * Only what a person just typed is ever sent to the AI, and this runs on it first.
 */
const REMOVED = "[removed]";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// South African ID numbers are 13 digits.
const ID_NUMBER = /(?<!\d)\d{13}(?!\d)/g;
// 0XX XXX XXXX, +27 XX XXX XXXX, (0XX) XXX-XXXX and unspaced forms. Prices never start with 0 or +27.
const PHONE = /(?<![\d\w])(?:\+27\s?\(?0?|\(?0)\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

export function stripContactDetails(text: string): string {
  return text
    .replace(EMAIL, REMOVED)
    .replace(ID_NUMBER, REMOVED)
    .replace(PHONE, REMOVED)
    .replace(/\s+/g, " ")
    .trim();
}

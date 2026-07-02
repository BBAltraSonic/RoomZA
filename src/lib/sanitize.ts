const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_PATTERN = /javascript\s*:[^\s<>"']*/gi;
const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeUserText(value: string) {
  return value
    .replace(SCRIPT_TAG_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(JAVASCRIPT_URL_PATTERN, "")
    .replace(CONTROL_CHARS_PATTERN, "")
    .trim();
}

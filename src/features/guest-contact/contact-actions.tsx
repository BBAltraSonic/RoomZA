import type { PublicContact } from "./schema";
import { publicContactSchema } from "./schema";

export type DirectContactChannel = "whatsapp" | "phone" | "email";
export type DirectContactLink = { channel: DirectContactChannel; label: string; value: string; href: string; external: boolean };

const CHANNEL_LABELS: Record<DirectContactChannel, string> = { whatsapp: "WhatsApp", phone: "Call", email: "Email" };

/**
 * The lister's published channels, fastest reply first, each with a prefilled enquiry.
 * Invalid or unconsented details never reach a link.
 */
export function directContactLinks(contact: PublicContact | null | undefined, title: string, message = "Hi, I'd like to enquire about " + title + "."): DirectContactLink[] {
  const parsed = publicContactSchema.safeParse(contact);
  const value = parsed.success ? parsed.data : null;
  if (!value) return [];
  const links: DirectContactLink[] = [];
  if (value.whatsapp) links.push({ channel: "whatsapp", label: CHANNEL_LABELS.whatsapp, value: value.whatsapp, href: "https://wa.me/" + value.whatsapp.slice(1) + "?text=" + encodeURIComponent(message), external: true });
  if (value.phone) links.push({ channel: "phone", label: CHANNEL_LABELS.phone, value: value.phone, href: "tel:" + value.phone, external: false });
  if (value.email) links.push({ channel: "email", label: CHANNEL_LABELS.email, value: value.email, href: "mailto:" + encodeURIComponent(value.email) + "?subject=" + encodeURIComponent("Enquiry: " + title) + "&body=" + encodeURIComponent(message), external: false });
  return links;
}

/** `compact` trims the row height for a mouse; touch keeps the full 44px targets. */
export function ContactActions({ contact, title, disabled = false, compact = false }: { contact?: PublicContact | null; title: string; disabled?: boolean; compact?: boolean }) {
  const height = compact ? "min-h-11 [@media(pointer:fine)]:min-h-8" : "min-h-11";
  const links = directContactLinks(contact, title);
  if (!links.length) return <p className="text-xs text-muted-foreground">Contact details not provided</p>;
  return <div role="group" aria-label="Direct contact" className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {links.map(link => disabled
      ? <span key={link.label} aria-disabled="true" className={"inline-flex items-center text-sm text-muted-foreground " + height}>{link.label}</span>
      : <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} className={"inline-flex items-center text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + height}>{link.label}</a>)}
  </div>;
}

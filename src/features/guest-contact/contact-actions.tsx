import type { PublicContact } from "./schema";
import { publicContactSchema } from "./schema";

/** `compact` trims the row height for a mouse; touch keeps the full 44px targets. */
export function ContactActions({ contact, title, disabled = false, compact = false }: { contact?: PublicContact | null; title: string; disabled?: boolean; compact?: boolean }) {
  const height = compact ? "min-h-11 [@media(pointer:fine)]:min-h-8" : "min-h-11";
  const parsed = publicContactSchema.safeParse(contact);
  const value = parsed.success ? parsed.data : null;
  const message = "Hi, I'd like to enquire about " + title + ".";
  const links = [
    ...(value?.whatsapp ? [{ label: "WhatsApp", href: "https://wa.me/" + value.whatsapp.slice(1) + "?text=" + encodeURIComponent(message) }] : []),
    ...(value?.phone ? [{ label: "Call", href: "tel:" + value.phone }] : []),
    ...(value?.email ? [{ label: "Email", href: "mailto:" + encodeURIComponent(value.email) + "?subject=" + encodeURIComponent("Enquiry: " + title) + "&body=" + encodeURIComponent(message) }] : []),
  ];
  if (!links.length) return <p className="text-xs text-muted-foreground">Contact details not provided</p>;
  return <div role="group" aria-label="Direct contact" className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {links.map(link => disabled
      ? <span key={link.label} aria-disabled="true" className={"inline-flex items-center text-sm text-muted-foreground " + height}>{link.label}</span>
      : <a key={link.label} href={link.href} target={link.label === "WhatsApp" ? "_blank" : undefined} rel={link.label === "WhatsApp" ? "noopener noreferrer" : undefined} className={"inline-flex items-center text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " + height}>{link.label}</a>)}
  </div>;
}

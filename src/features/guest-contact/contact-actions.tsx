import type { PublicContact } from "./schema";
import { publicContactSchema } from "./schema";

export function ContactActions({ contact, title, disabled = false }: { contact?: PublicContact | null; title: string; disabled?: boolean }) {
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
      ? <span key={link.label} aria-disabled="true" className="inline-flex min-h-11 items-center text-sm text-muted-foreground">{link.label}</span>
      : <a key={link.label} href={link.href} target={link.label === "WhatsApp" ? "_blank" : undefined} rel={link.label === "WhatsApp" ? "noopener noreferrer" : undefined} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{link.label}</a>)}
  </div>;
}

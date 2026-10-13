import type { PublicContact } from "./schema";

export function ContactPreview({ contact, consent }: { contact?: PublicContact; consent?: boolean }) {
  return <section className="space-y-2 text-sm" aria-label="Contact publication review">
    <h3 className="font-semibold">Guest enquiries</h3>
    <dl className="grid gap-2">{(["phone", "whatsapp", "email"] as const).filter(key => contact?.[key]).map(key => <div key={key}><dt className="text-muted-foreground">{key === "phone" ? "Public phone" : key === "whatsapp" ? "Public WhatsApp" : "Public email"}</dt><dd className="break-words">{contact?.[key]}</dd></div>)}</dl>
    <p>{consent ? "Public contact permission confirmed for this content." : "Public contact permission not confirmed."}</p>
  </section>;
}

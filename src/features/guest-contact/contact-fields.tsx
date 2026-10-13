"use client";
import type { PublicContact } from "./schema";

export function ContactFields({ value, consent, onChange, onConsentChange, disabled = false, idPrefix = "public-contact", includePhone = true }: {
  value: PublicContact; consent: boolean; onChange: (value: PublicContact) => void; onConsentChange: (value: boolean) => void;
  disabled?: boolean; idPrefix?: string; includePhone?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="mb-2 text-base font-semibold">Guest enquiries</legend>
    <p className="text-sm text-muted-foreground">Add at least one public contact so guests can enquire without an account. Existing listings stay available; add contact details to help new visitors.</p>
    <div className="grid gap-4 sm:grid-cols-2">{(["phone", "whatsapp", "email"] as const).filter(key => includePhone || key !== "phone").map(key => <label key={key} htmlFor={idPrefix + "-" + key} className="grid gap-2 text-sm font-medium">
      {key === "phone" ? "Public phone" : key === "whatsapp" ? "Public WhatsApp number" : "Public email"}
      <input id={idPrefix + "-" + key} type={key === "email" ? "email" : "tel"} maxLength={key === "email" ? 254 : 16} value={value[key] ?? ""} placeholder={key === "email" ? "enquiries@example.com" : "+27215550100"}
        className="min-h-11 min-w-0 rounded-lg border border-border bg-panel px-3 py-2" onChange={event => { const next = { ...value }; if (event.target.value) next[key] = event.target.value; else delete next[key]; onChange(next); onConsentChange(false); }} />
    </label>)}</div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={event => onConsentChange(event.target.checked)} className="mt-1 size-5 shrink-0" /><span>I have permission to make these contact details public for guest enquiries.</span></label>
  </fieldset>;
}

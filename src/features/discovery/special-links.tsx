import type { SpecialLinks } from "./special-link-schema";
export { specialUrlSchema, specialLinkFields } from "./special-link-schema";
export type { SpecialLinks } from "./special-link-schema";

export function SpecialLinkFields({ value, disabled, onChange }: { value: SpecialLinks; disabled?: boolean; onChange: (value: SpecialLinks) => void }) {
  return <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
    <legend className="mb-3 text-base font-semibold">Visit and booking links</legend>
    <p className="text-sm text-muted-foreground sm:col-span-2">Link to this particular special, event or experience. Leave a link empty when it does not apply.</p>
    {(["visitUrl", "bookingUrl"] as const).map(key => <label key={key} className="grid gap-2 text-sm font-medium">
      {key === "visitUrl" ? "Visit link" : "Booking link"}
      <input type="url" name={key} maxLength={2048} value={value[key] ?? ""} placeholder="https://" className="min-h-11 min-w-0 rounded-xl border border-border bg-panel px-3 py-2" onChange={event => onChange({ ...value, [key]: event.target.value })} />
    </label>)}
  </fieldset>;
}

export function SpecialLinkPreview({ value }: { value: SpecialLinks }) {
  return <dl className="space-y-2 text-sm">{(["visitUrl", "bookingUrl"] as const).map(key => value[key] ? <div key={key}><dt className="text-muted-foreground">{key === "visitUrl" ? "Visit link" : "Booking link"}</dt><dd className="break-all"><a href={value[key]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-forest underline">{value[key]}</a></dd></div> : null)}</dl>;
}

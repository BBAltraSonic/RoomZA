import { z } from "zod";

// International numbers are unambiguous for tel: and WhatsApp on any device.
export const publicPhoneSchema = z.string().trim().regex(/^\+[1-9][0-9]{6,14}$/, "Use an international number, for example +27215550100");
export const publicContactSchema = z.object({
  phone: publicPhoneSchema.optional(),
  whatsapp: publicPhoneSchema.optional(),
  email: z.string().trim().max(254).email().optional(),
}).strict();
export type PublicContact = z.infer<typeof publicContactSchema>;

export function hasPublicContact(contact?: PublicContact | null) {
  return Boolean(contact?.phone || contact?.whatsapp || contact?.email);
}
export function readPublicContact(value: unknown, consent: unknown): PublicContact | null {
  if (consent !== true) return null;
  const parsed = publicContactSchema.safeParse(value);
  return parsed.success && hasPublicContact(parsed.data) ? parsed.data : null;
}
export function requirePublicContact(contact: unknown, consent: unknown) {
  const parsed = publicContactSchema.parse(contact ?? {});
  if (!hasPublicContact(parsed)) throw new Error("Add a public phone, WhatsApp number or email for guest enquiries.");
  if (consent !== true) throw new Error("Confirm permission to publish these contact details.");
  return parsed;
}

// Service phone numbers were already explicitly public before guest enquiries.
export function servicePublicContact(content: { phone: string; publicContact?: PublicContact; contactConsent?: boolean }): PublicContact | null {
  let phone = content.phone.replace(/[ ()-]/g, "");
  if (/^0[1-9][0-9]{8}$/.test(phone)) phone = "+27" + phone.slice(1);
  const validPhone = publicPhoneSchema.safeParse(phone);
  const extra = readPublicContact(content.publicContact, content.contactConsent);
  return validPhone.success ? { ...extra, phone: validPhone.data } : extra;
}

export function propertyPublicContact(metadata: unknown): PublicContact | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  return readPublicContact(value.publicContact, value.contactConsent);
}

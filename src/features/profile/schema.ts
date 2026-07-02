import { z } from "zod";

export const updateProfileSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required").max(50, "Phone number is too long"),
});

export function validateProfileUpdateInput(phone: FormDataEntryValue | null) {
  return updateProfileSchema.safeParse({ phone });
}

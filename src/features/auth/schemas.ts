import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters."),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

export function firstSchemaError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid form input.";
}

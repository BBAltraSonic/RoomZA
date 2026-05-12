import { z } from "zod";

export const documentTypeSchema = z.enum(["id", "payslip"]);

export const applicationSchema = z.object({
    listingId: z.string().uuid(),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    income: z.coerce.number().min(0, "Income must be a valid number"),
    employmentStatus: z.string().min(2, "Employment status is required"),
    moveInDate: z.string(),
    householdSize: z.coerce.number().min(1, "Household size must be at least 1").max(10, "Household size seems too large"),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

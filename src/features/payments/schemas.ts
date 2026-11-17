import { z } from "zod";

/** Every id the deposit actions take: payments, applications and Paystack events. */
export const depositIdSchema = z.string().uuid();

/** What a deposit state change returns, as far as the actions read it. */
export const depositStateResultSchema = z.object({ state: z.string() });

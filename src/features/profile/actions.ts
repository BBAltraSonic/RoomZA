"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
    phone: z.string().min(1, "Phone number is required").max(50, "Phone number is too long"),
});

type ProfileActionState = {
    success: boolean;
    message: string;
};

/**
 * Server action: update the user's profile phone number.
 * Domain logic extracted from `src/app/profile/actions.ts` (R2.1).
 */
export async function updateProfileAction(_prevState: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
    try {
        const { user, profile } = await requireUser();

        if (!profile) {
            return { success: false, message: "Profile not fully loaded. Try again." };
        }

        const phone = formData.get("phone");
        const parsed = updateProfileSchema.safeParse({ phone });

        if (!parsed.success) {
            return {
                success: false,
                message: parsed.error.errors[0]?.message || "Invalid input",
            };
        }

        const newPhone = parsed.data.phone.trim();

        if (newPhone === profile.phone) {
            return {
                success: true,
                message: "Profile updated successfully.",
            };
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from("profiles")
            .update({
                phone: newPhone,
                updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

        if (error) {
            logger.error("Failed to update profile phone", {
                userId: user.id,
                error: error.message,
            });
            return {
                success: false,
                message: "Failed to update profile. Please try again.",
            };
        }

        revalidatePath("/profile");

        return {
            success: true,
            message: "Profile updated successfully.",
        };
    } catch (error) {
        logger.error("Unexpected error updating profile", {
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        };
    }
}

"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import { updateProfileSchema } from "./schema";
import { ProfileUpdateTimeoutError, withProfileUpdateTimeout } from "./update-timeout";

export type ProfileActionState = {
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

        const parsed = updateProfileSchema.safeParse({
            phone: formData.get("phone"),
        });

        if (!parsed.success) {
            return {
                success: false,
                message: parsed.error.errors[0]?.message || "Invalid input",
            };
        }

        const newPhone = parsed.data.phone;

        if (newPhone === profile.phone) {
            return {
                success: true,
                message: "Profile updated successfully.",
            };
        }

        const supabase = await createClient();
        let updateError: unknown = null;
        try {
            const { error } = await withProfileUpdateTimeout(
                supabase
                    .from("profiles")
                    .update({
                        phone: newPhone,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", user.id),
            );
            updateError = error;
        } catch (error) {
            updateError = error;
        }

        if (updateError) {
            logger.error("Failed to update profile phone", {
                userId: user.id,
                error: updateError instanceof Error ? updateError.message : String(updateError),
            });
            return {
                success: false,
                message: updateError instanceof ProfileUpdateTimeoutError
                    ? "Profile update could not be confirmed within 2 seconds."
                    : "Failed to update profile. Please try again.",
            };
        }

        revalidatePath("/profile");
        if (profile.role === "landlord") {
            revalidatePath("/dashboard");
        }

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

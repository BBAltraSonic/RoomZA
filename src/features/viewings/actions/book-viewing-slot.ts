'use server'

import { createClient } from '@/lib/supabase/server'
import { enqueueNotificationEvent } from '@/features/notifications/outbox'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/action-result'

const bookViewingSchema = z.object({
    slotId: z.string().uuid(),
    applicationId: z.string().uuid(),
})

export async function bookViewingSlot(payload: z.infer<typeof bookViewingSchema>): Promise<ActionResult<string>> {
    const supabase = await createClient()

    // Layer 1: Entry Point Validation
    const result = bookViewingSchema.safeParse(payload)
    if (!result.success) {
        return actionFailure('Invalid input', result.error.flatten())
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return actionFailure('Unauthorized')

    const { slotId, applicationId } = result.data

    // Layer 2: Business Validation
    const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id, listing_id, renter_id')
        .eq('id', applicationId)
        .eq('renter_id', user.id)
        .single()

    if (appError || !application) {
        return actionFailure('Application not found or unauthorized')
    }

    const { data: listing } = await supabase
        .from('listings')
        .select('landlord_id')
        .eq('id', application.listing_id)
        .single()

    // Layer 3: Atomic constraint (Defense in Depth)
    const { data: viewingId, error: rpcError } = await supabase
        .rpc('book_viewing_slot_atomic', {
            target_slot_id: slotId,
            target_application_id: applicationId
        })

    if (rpcError || !viewingId) {
        return actionFailure('Failed to book slot. It may have already been booked or offered to someone else.')
    }

    // Notify landlord
    if (listing?.landlord_id) {
        const { data: notification } = await supabase.from('notification_events').insert({
            recipient_id: listing.landlord_id,
            type: 'viewing_booked' as const,
            idempotency_key: `viewing_booked:${viewingId}`,
            payload: { applicationId, viewingId, message: 'A viewing has been booked.' }
        }).select('id').single()

        if (notification?.id) {
            await enqueueNotificationEvent(notification.id)
        }
    }

    revalidatePath('/applications')
    revalidatePath(`/viewings/${viewingId}/live`)

    return actionSuccess(viewingId as string)
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { enqueueNotificationEvent } from '@/features/notifications/outbox'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { validateViewingSlots } from '../slot-validation'
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/action-result'
import { requireRole } from '@/lib/auth'
import { buildViewingProposedNotifications } from '../notifications'

const proposeViewingSchema = z.object({
    listingId: z.string().uuid(),
    applicationIds: z.array(z.string().uuid()).min(1),
    mode: z.enum(['in_person', 'video_call']).default('in_person'),
    slots: z.array(z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime()
    })).min(1).max(20)
})

export async function proposeViewingSlots(payload: z.infer<typeof proposeViewingSchema>): Promise<ActionResult> {
    const { user } = await requireRole('landlord')
    const supabase = await createClient()

    // Layer 1: Entry Point Validation
    const result = proposeViewingSchema.safeParse(payload)
    if (!result.success) {
        return actionFailure('Invalid input', result.error.flatten())
    }

    const { listingId, applicationIds, mode, slots } = result.data

    const slotValidation = validateViewingSlots(slots, new Date())
    if (!slotValidation.valid) {
        return actionFailure('Invalid viewing slots', { formErrors: slotValidation.errors, fieldErrors: {} })
    }

    // Layer 2: Business Logic Validation
    const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id')
        .eq('id', listingId)
        .eq('landlord_id', user.id)
        .single()

    if (listingError || !listing) {
        return actionFailure('Listing not found or you are not the owner')
    }

    const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('id, renter_id')
        .eq('listing_id', listingId)
        .in('id', applicationIds)

    if (appsError || !applications || applications.length !== applicationIds.length) {
        return actionFailure('One or more applications are invalid or do not belong to this listing.')
    }

    // Layer 3: Environment Guards & DB Constraints
    const { data: insertedSlots, error: slotsError } = await supabase
        .from('viewing_slots')
        .insert(
            slots.map(s => ({
                listing_id: listingId,
                created_by: user.id,
                start_time: s.startTime,
                end_time: s.endTime,
                mode,
                is_booked: false
            }))
        )
        .select('id')

    if (slotsError || !insertedSlots) {
        return actionFailure('Failed to create slots')
    }

    const slotOffers = []
    for (const slot of insertedSlots) {
        for (const appId of applicationIds) {
            slotOffers.push({
                slot_id: slot.id,
                application_id: appId
            })
        }
    }

    const { error: offersError } = await supabase
        .from('viewing_slot_offers')
        .insert(slotOffers)

    if (offersError) {
        return actionFailure('Failed to create slot offers')
    }

    // Layer 4 & Notifications
    const notificationEvents = buildViewingProposedNotifications({
        listingId,
        mode,
        slotIds: insertedSlots.map((slot) => slot.id),
        applications,
    })

    const { data: notifications } = await supabase
        .from('notification_events')
        .insert(notificationEvents)
        .select('id')

    await Promise.all((notifications ?? []).map((notification) => enqueueNotificationEvent(notification.id)))

    revalidatePath(`/dashboard/listings/${listingId}/applicants`)

    return actionSuccess(undefined)
}

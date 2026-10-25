'use server'

import { createClient } from '@/lib/supabase/server'
import { createUntypedClient } from '@/lib/supabase/admin'
import { recordAndEnqueueNotifications } from '@/features/notifications/outbox'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { validateViewingSlots } from '../slot-validation'
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/action-result'
import { requireAnyPersona } from '@/lib/auth'
import { buildViewingProposedNotifications } from '../notifications'
import { authorizeManagedListing } from '@/features/listings/authorization'
import { getListingManagementScope } from '@/features/listings/management-scope'

const proposeViewingSchema = z.object({
    proposalId: z.string().uuid(),
    listingId: z.string().uuid(),
    applicationIds: z.array(z.string().uuid()).min(1),
    mode: z.enum(['in_person', 'video_call']).default('in_person'),
    slots: z.array(z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime()
    })).min(1).max(20)
})

export async function proposeViewingSlots(payload: z.infer<typeof proposeViewingSchema>): Promise<ActionResult> {
    const { user } = await requireAnyPersona(['landlord', 'seller'])
    const [supabase, scope] = await Promise.all([createClient(), getListingManagementScope()])
    const claims = await supabase.auth.getClaims()
    const sessionId = z.string().uuid().safeParse(claims.data?.claims.session_id)
    if (claims.error || claims.data?.claims.sub !== user.id || !sessionId.success)
        return actionFailure('Sign in again before proposing viewing times.')

    // Layer 1: Entry Point Validation
    const result = proposeViewingSchema.safeParse(payload)
    if (!result.success) {
        return actionFailure('Invalid input', result.error.flatten())
    }

    const { proposalId, listingId, applicationIds, mode, slots } = result.data

    const slotValidation = validateViewingSlots(slots, new Date())
    if (!slotValidation.valid) {
        return actionFailure('Invalid viewing slots', { formErrors: slotValidation.errors, fieldErrors: {} })
    }

    // Layer 2: Business Logic Validation
    const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, landlord_id, organization_id')
        .eq('id', listingId)
        .single()

    const management = authorizeManagedListing({
        ownerId: listing?.landlord_id,
        organizationId: listing?.organization_id,
        userId: user.id,
        managedOrganizationId: scope.managedOrganizationId,
    })
    if (listingError || !listing || !management.allowed) {
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

    // The transaction revalidates session, ownership and applications. Its
    // receipt also recovers an otherwise uncertain committed response.
    const { data, error } = await createUntypedClient().rpc('pinpoint_rental_viewing_propose', {
        actor_id: user.id, actor_session_id: sessionId.data, proposal_id: proposalId,
        target_listing_id: listingId, target_application_ids: applicationIds,
        proposed_mode: mode, proposed_slots: slots,
    })
    if (error) return actionFailure(error.code === '42501'
        ? 'The listing or application is unavailable. Reload before proposing times.'
        : error.code === 'PT409'
          ? 'The proposal or viewing times changed. Check your viewings before retrying.'
          : 'Unable to confirm viewing times. Retry the same proposal, or check your viewings before sending different times.')
    const confirmed = z.object({ slotIds: z.array(z.string().uuid()).min(1) }).safeParse(data)
    if (!confirmed.success) return actionFailure('Unable to confirm viewing times. Retry the same proposal or check your viewings.')

    // Layer 4 & Notifications
    const notificationEvents = buildViewingProposedNotifications({
        listingId,
        mode,
        slotIds: confirmed.data.slotIds,
        applications,
    })

    await recordAndEnqueueNotifications(notificationEvents)

    revalidatePath(`/dashboard/listings/${listingId}/applicants`)

    return actionSuccess(undefined)
}

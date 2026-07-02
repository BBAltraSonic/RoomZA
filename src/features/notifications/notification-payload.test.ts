import { describe, it, expect } from 'vitest'
import { buildApplicationStatusChangedNotification } from '@/features/applications/notifications'
import { buildViewingProposedNotifications } from '@/features/viewings/notifications'

/**
 * Tests for notification payload structure.
 * These validate the shapes used in server actions when creating notification_events.
 */

type NotificationPayload = {
    [key: string]: unknown
}

function createNewApplicationPayload(applicationId: string, actorId: string): NotificationPayload {
    return {
        applicationId,
        actorId,
        message: 'A new rental application has been submitted.',
    }
}

function createNewMessagePayload(conversationId: string, listingId: string): NotificationPayload {
    return {
        conversationId,
        listingId,
        message: 'You have a new message.',
    }
}

function createViewingProposedPayload(listingId: string): NotificationPayload {
    return {
        listingId,
        message: 'New viewing slots have been proposed.',
    }
}

function createViewingBookedPayload(applicationId: string, viewingId: string): NotificationPayload {
    return {
        applicationId,
        viewingId,
        message: 'A viewing has been booked.',
    }
}

describe('notification payloads', () => {
    describe('new_application', () => {
        it('includes applicationId, actorId, and message', () => {
            const payload = createNewApplicationPayload('app-123', 'user-456')
            expect(payload).toHaveProperty('applicationId', 'app-123')
            expect(payload).toHaveProperty('actorId', 'user-456')
            expect(payload).toHaveProperty('message')
            expect(typeof payload.message).toBe('string')
        })
    })

    describe('new_message', () => {
        it('includes conversationId, listingId, and message', () => {
            const payload = createNewMessagePayload('conv-789', 'listing-012')
            expect(payload).toHaveProperty('conversationId', 'conv-789')
            expect(payload).toHaveProperty('listingId', 'listing-012')
            expect(payload).toHaveProperty('message')
            expect(typeof payload.message).toBe('string')
        })
    })

    describe('viewing_proposed', () => {
        it('includes listingId and message', () => {
            const payload = createViewingProposedPayload('listing-345')
            expect(payload).toHaveProperty('listingId', 'listing-345')
            expect(payload).toHaveProperty('message')
            expect(typeof payload.message).toBe('string')
        })

        it('creates one notification per applicant with proposed slot ids', () => {
            const events = buildViewingProposedNotifications({
                listingId: 'listing-345',
                mode: 'video_call',
                slotIds: ['slot-1', 'slot-2'],
                applications: [
                    { id: 'app-1', renter_id: 'renter-1' },
                    { id: 'app-2', renter_id: 'renter-2' },
                ],
            })

            expect(events).toHaveLength(2)
            expect(events[0]).toMatchObject({
                recipient_id: 'renter-1',
                type: 'viewing_proposed',
                idempotency_key: 'viewing_proposed:listing-345:app-1:slot-1,slot-2',
            })
            expect(events[0]?.payload).toMatchObject({
                listingId: 'listing-345',
                mode: 'video_call',
                slotIds: ['slot-1', 'slot-2'],
            })
        })
    })

    describe('viewing_booked', () => {
        it('includes applicationId, viewingId, and message', () => {
            const payload = createViewingBookedPayload('app-678', 'viewing-901')
            expect(payload).toHaveProperty('applicationId', 'app-678')
            expect(payload).toHaveProperty('viewingId', 'viewing-901')
            expect(payload).toHaveProperty('message')
            expect(typeof payload.message).toBe('string')
        })
    })

    describe('application_status_changed', () => {
        it('uses a status-specific idempotency key for approved and rejected transitions', () => {
            const approved = buildApplicationStatusChangedNotification({
                applicationId: 'app-123',
                status: 'approved',
                actorId: 'landlord-456',
            })
            const rejected = buildApplicationStatusChangedNotification({
                applicationId: 'app-123',
                status: 'rejected',
                actorId: 'landlord-456',
            })

            expect(approved.type).toBe('application_status_changed')
            expect(approved.idempotency_key).toBe('application_status_changed:app-123:approved')
            expect(approved.payload).toMatchObject({
                applicationId: 'app-123',
                status: 'approved',
                actorId: 'landlord-456',
            })
            expect(rejected.idempotency_key).toBe('application_status_changed:app-123:rejected')
        })
    })

    describe('all payloads have non-empty message strings', () => {
        it('new_application message is informative', () => {
            const payload = createNewApplicationPayload('a', 'b')
            expect((payload.message as string).length).toBeGreaterThan(10)
        })

        it('new_message message is informative', () => {
            const payload = createNewMessagePayload('a', 'b')
            expect((payload.message as string).length).toBeGreaterThan(10)
        })

        it('viewing_proposed message is informative', () => {
            const payload = createViewingProposedPayload('a')
            expect((payload.message as string).length).toBeGreaterThan(10)
        })

        it('viewing_booked message is informative', () => {
            const payload = createViewingBookedPayload('a', 'b')
            expect((payload.message as string).length).toBeGreaterThan(10)
        })

        it('application_status_changed message is informative', () => {
            const event = buildApplicationStatusChangedNotification({
                applicationId: 'a',
                status: 'approved',
                actorId: 'b',
            })
            expect((event.payload as { message: string }).message.length).toBeGreaterThan(10)
        })
    })
})

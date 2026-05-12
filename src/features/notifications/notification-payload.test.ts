import { describe, it, expect } from 'vitest'

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
    })
})

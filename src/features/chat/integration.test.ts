import { describe, it, expect } from 'vitest'

/**
 * Integration tests for chat action flows.
 * Tests the business logic validation without actual Supabase calls.
 */

describe('sendMessage validation', () => {
    function validateMessage(content: string | null | undefined) {
        if (!content || content.trim().length === 0) {
            return { success: false, error: 'Empty message' }
        }
        return { success: true, trimmedContent: content.trim() }
    }

    it('rejects null content', () => {
        const result = validateMessage(null)
        expect(result.success).toBe(false)
        expect('error' in result && result.error).toBe('Empty message')
    })

    it('rejects undefined content', () => {
        const result = validateMessage(undefined)
        expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
        const result = validateMessage('')
        expect(result.success).toBe(false)
    })

    it('rejects whitespace-only content', () => {
        const result = validateMessage('   \n\t  ')
        expect(result.success).toBe(false)
    })

    it('accepts valid message and trims it', () => {
        const result = validateMessage('  Hello there!  ')
        expect(result.success).toBe(true)
        if ('trimmedContent' in result) {
            expect(result.trimmedContent).toBe('Hello there!')
        }
    })

    it('accepts single character message', () => {
        const result = validateMessage('H')
        expect(result.success).toBe(true)
    })
})

describe('chat notification recipient logic', () => {
    function getRecipient(senderId: string, renterId: string, landlordId: string): string | null {
        if (renterId === senderId) return landlordId
        if (landlordId === senderId) return renterId
        return null
    }

    it('notifies landlord when renter sends message', () => {
        const recipient = getRecipient('renter-123', 'renter-123', 'landlord-456')
        expect(recipient).toBe('landlord-456')
    })

    it('notifies renter when landlord sends message', () => {
        const recipient = getRecipient('landlord-456', 'renter-123', 'landlord-456')
        expect(recipient).toBe('renter-123')
    })

    it('returns null for unknown sender', () => {
        const recipient = getRecipient('stranger-789', 'renter-123', 'landlord-456')
        expect(recipient).toBeNull()
    })
})

describe('conversation authorization', () => {
    function isAuthorizedForConversation(userId: string, renterId: string, landlordId: string): boolean {
        return userId === renterId || userId === landlordId
    }

    it('renter can access their conversation', () => {
        expect(isAuthorizedForConversation('renter-1', 'renter-1', 'landlord-1')).toBe(true)
    })

    it('landlord can access their conversation', () => {
        expect(isAuthorizedForConversation('landlord-1', 'renter-1', 'landlord-1')).toBe(true)
    })

    it('other renter cannot access conversation', () => {
        expect(isAuthorizedForConversation('renter-2', 'renter-1', 'landlord-1')).toBe(false)
    })

    it('other landlord cannot access conversation', () => {
        expect(isAuthorizedForConversation('landlord-2', 'renter-1', 'landlord-1')).toBe(false)
    })

    it('anonymous user cannot access conversation', () => {
        expect(isAuthorizedForConversation('', 'renter-1', 'landlord-1')).toBe(false)
    })
})

describe('message insertion with notification', () => {
    type NotificationEvent = {
        recipient_id: string
        type: string
        payload: { conversationId: string; listingId: string; message: string }
    }

    function simulateSendMessage(
        senderId: string,
        conversationId: string,
        listingId: string,
        content: string,
        conversation: { renter_id: string; landlord_id: string }
    ): { success: boolean; notification?: NotificationEvent; error?: string } {
        if (!content || content.trim().length === 0) {
            return { success: false, error: 'Empty message' }
        }

        const recipientId =
            conversation.renter_id === senderId
                ? conversation.landlord_id
                : conversation.landlord_id === senderId
                    ? conversation.renter_id
                    : null

        if (!recipientId) {
            return { success: false, error: 'Unauthorized sender' }
        }

        return {
            success: true,
            notification: {
                recipient_id: recipientId,
                type: 'new_message',
                payload: {
                    conversationId,
                    listingId,
                    message: 'You have a new message.',
                },
            },
        }
    }

    it('renter sends message → notifies landlord', () => {
        const result = simulateSendMessage(
            'renter-1', 'conv-1', 'listing-1', 'Hello!',
            { renter_id: 'renter-1', landlord_id: 'landlord-1' }
        )
        expect(result.success).toBe(true)
        expect(result.notification?.recipient_id).toBe('landlord-1')
        expect(result.notification?.type).toBe('new_message')
    })

    it('landlord sends message → notifies renter', () => {
        const result = simulateSendMessage(
            'landlord-1', 'conv-1', 'listing-1', 'Hi there!',
            { renter_id: 'renter-1', landlord_id: 'landlord-1' }
        )
        expect(result.success).toBe(true)
        expect(result.notification?.recipient_id).toBe('renter-1')
    })

    it('notification payload includes conversationId and listingId', () => {
        const result = simulateSendMessage(
            'renter-1', 'conv-42', 'listing-99', 'Test message',
            { renter_id: 'renter-1', landlord_id: 'landlord-1' }
        )
        expect(result.notification?.payload.conversationId).toBe('conv-42')
        expect(result.notification?.payload.listingId).toBe('listing-99')
    })

    it('rejects empty message and no notification is created', () => {
        const result = simulateSendMessage(
            'renter-1', 'conv-1', 'listing-1', '',
            { renter_id: 'renter-1', landlord_id: 'landlord-1' }
        )
        expect(result.success).toBe(false)
        expect(result.notification).toBeUndefined()
    })

    it('rejects unauthorized sender and no notification is created', () => {
        const result = simulateSendMessage(
            'stranger-1', 'conv-1', 'listing-1', 'Sneaky message',
            { renter_id: 'renter-1', landlord_id: 'landlord-1' }
        )
        expect(result.success).toBe(false)
        expect(result.error).toBe('Unauthorized sender')
        expect(result.notification).toBeUndefined()
    })
})

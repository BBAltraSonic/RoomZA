import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * These schemas mirror the Zod schemas defined inline within the viewing action files.
 * We test them directly to validate input constraints without needing to invoke server actions.
 */

const bookViewingSchema = z.object({
    slotId: z.string().uuid(),
    applicationId: z.string().uuid(),
})

const proposeViewingSchema = z.object({
    listingId: z.string().uuid(),
    applicationIds: z.array(z.string().uuid()).min(1),
    mode: z.enum(['in_person', 'video_call']).default('in_person'),
    slots: z.array(z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
    })).min(1).max(20),
})

describe('bookViewingSchema', () => {
    it('accepts valid UUIDs', () => {
        const result = bookViewingSchema.safeParse({
            slotId: '550e8400-e29b-41d4-a716-446655440000',
            applicationId: '550e8400-e29b-41d4-a716-446655440001',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid slotId', () => {
        const result = bookViewingSchema.safeParse({
            slotId: 'not-a-uuid',
            applicationId: '550e8400-e29b-41d4-a716-446655440001',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid applicationId', () => {
        const result = bookViewingSchema.safeParse({
            slotId: '550e8400-e29b-41d4-a716-446655440000',
            applicationId: 'bad-id',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing fields', () => {
        expect(bookViewingSchema.safeParse({}).success).toBe(false)
        expect(bookViewingSchema.safeParse({ slotId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(false)
    })
})

describe('proposeViewingSchema', () => {
    const validSlot = {
        startTime: '2026-06-15T10:00:00Z',
        endTime: '2026-06-15T10:30:00Z',
    }
    const validPayload = {
        listingId: '550e8400-e29b-41d4-a716-446655440000',
        applicationIds: ['550e8400-e29b-41d4-a716-446655440001'],
        slots: [validSlot],
    }

    it('accepts a valid proposal', () => {
        const result = proposeViewingSchema.safeParse(validPayload)
        expect(result.success).toBe(true)
    })

    it('accepts video call proposals', () => {
        const result = proposeViewingSchema.safeParse({ ...validPayload, mode: 'video_call' })
        expect(result.success).toBe(true)
    })

    it('rejects invalid viewing mode', () => {
        const result = proposeViewingSchema.safeParse({ ...validPayload, mode: 'phone_call' })
        expect(result.success).toBe(false)
    })

    it('rejects invalid listingId', () => {
        const result = proposeViewingSchema.safeParse({ ...validPayload, listingId: 'bad' })
        expect(result.success).toBe(false)
    })

    it('rejects empty applicationIds array', () => {
        const result = proposeViewingSchema.safeParse({ ...validPayload, applicationIds: [] })
        expect(result.success).toBe(false)
    })

    it('rejects invalid UUID in applicationIds', () => {
        const result = proposeViewingSchema.safeParse({
            ...validPayload,
            applicationIds: ['not-a-uuid'],
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty slots array', () => {
        const result = proposeViewingSchema.safeParse({ ...validPayload, slots: [] })
        expect(result.success).toBe(false)
    })

    it('rejects more than 20 slots', () => {
        const tooManySlots = Array.from({ length: 21 }, (_, i) => ({
            startTime: `2026-06-15T${String(i).padStart(2, '0')}:00:00Z`,
            endTime: `2026-06-15T${String(i).padStart(2, '0')}:30:00Z`,
        }))
        const result = proposeViewingSchema.safeParse({ ...validPayload, slots: tooManySlots })
        expect(result.success).toBe(false)
    })

    it('accepts exactly 20 slots', () => {
        const maxSlots = Array.from({ length: 20 }, (_, i) => ({
            startTime: `2026-06-15T${String(i).padStart(2, '0')}:00:00Z`,
            endTime: `2026-06-15T${String(i).padStart(2, '0')}:30:00Z`,
        }))
        const result = proposeViewingSchema.safeParse({ ...validPayload, slots: maxSlots })
        expect(result.success).toBe(true)
    })

    it('rejects invalid datetime format in slots', () => {
        const result = proposeViewingSchema.safeParse({
            ...validPayload,
            slots: [{ startTime: 'not-a-date', endTime: '2026-06-15T10:30:00Z' }],
        })
        expect(result.success).toBe(false)
    })

    it('accepts multiple applicationIds', () => {
        const result = proposeViewingSchema.safeParse({
            ...validPayload,
            applicationIds: [
                '550e8400-e29b-41d4-a716-446655440001',
                '550e8400-e29b-41d4-a716-446655440002',
                '550e8400-e29b-41d4-a716-446655440003',
            ],
        })
        expect(result.success).toBe(true)
    })
})

describe('viewing slot booking validation', () => {
    function validateSlotTiming(startTime: string, endTime: string) {
        const start = new Date(startTime)
        const end = new Date(endTime)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, error: 'Invalid date format' }
        }
        if (end <= start) {
            return { valid: false, error: 'End time must be after start time' }
        }
        return { valid: true }
    }

    it('accepts endTime after startTime', () => {
        const result = validateSlotTiming('2026-06-15T10:00:00Z', '2026-06-15T10:30:00Z')
        expect(result.valid).toBe(true)
    })

    it('rejects endTime before startTime', () => {
        const result = validateSlotTiming('2026-06-15T10:30:00Z', '2026-06-15T10:00:00Z')
        expect(result.valid).toBe(false)
        expect('error' in result && result.error).toContain('after start time')
    })

    it('rejects endTime equal to startTime', () => {
        const result = validateSlotTiming('2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z')
        expect(result.valid).toBe(false)
    })

    it('rejects invalid date strings', () => {
        const result = validateSlotTiming('not-a-date', '2026-06-15T10:30:00Z')
        expect(result.valid).toBe(false)
        expect('error' in result && result.error).toContain('Invalid date')
    })

    it('bookViewingSchema strips extra fields', () => {
        const result = bookViewingSchema.safeParse({
            slotId: '550e8400-e29b-41d4-a716-446655440000',
            applicationId: '550e8400-e29b-41d4-a716-446655440001',
            extraField: 'should-be-stripped',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect('extraField' in result.data).toBe(false)
        }
    })
})

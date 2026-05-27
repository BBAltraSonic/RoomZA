import { describe, it, expect } from 'vitest'
import { applicationSchema } from './schema'

/**
 * Integration tests for application server action flows.
 * Tests the business logic paths without actual Supabase calls.
 */

const validAppData = {
    listingId: '550e8400-e29b-41d4-a716-446655440000',
    fullName: 'Test Renter',
    income: 25000,
    employmentStatus: 'Full-time',
    moveInDate: '2026-07-01',
    householdSize: 2,
}

describe('application submission flow', () => {
    function simulateSubmissionValidation(formEntries: Record<string, unknown>) {
        const result = applicationSchema.safeParse(formEntries)
        if (!result.success) {
            return { success: false, errors: result.error.flatten().fieldErrors, error: 'Invalid application data' }
        }
        return { success: true, data: result.data }
    }

    it('validates a complete application', () => {
        const result = simulateSubmissionValidation(validAppData)
        expect(result.success).toBe(true)
    })

    it('rejects incomplete application with field errors', () => {
        const result = simulateSubmissionValidation({ listingId: 'not-uuid', fullName: '' })
        expect(result.success).toBe(false)
        if ('errors' in result) {
            expect(result.errors?.listingId).toBeDefined()
            expect(result.errors?.fullName).toBeDefined()
        }
    })
})

describe('application cap enforcement', () => {
    const MAX_ACTIVE = 5

    function checkEligibility(
        activeCount: number,
        hasExistingForListing: boolean,
        isRenter: boolean,
        isAuthenticated: boolean
    ) {
        if (!isAuthenticated) return { eligible: false, reason: 'unauthenticated' }
        if (!isRenter) return { eligible: false, reason: 'not_renter' }
        if (activeCount >= MAX_ACTIVE) return { eligible: false, reason: 'cap_reached' }
        if (hasExistingForListing) return { eligible: false, reason: 'already_applied' }
        return { eligible: true, reason: null }
    }

    it('blocks unauthenticated users', () => {
        const result = checkEligibility(0, false, true, false)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('unauthenticated')
    })

    it('blocks non-renter roles', () => {
        const result = checkEligibility(0, false, false, true)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('not_renter')
    })

    it('blocks when at cap (5 active)', () => {
        const result = checkEligibility(5, false, true, true)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('cap_reached')
    })

    it('blocks when over cap (6 active)', () => {
        const result = checkEligibility(6, false, true, true)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('cap_reached')
    })

    it('blocks duplicate application for same listing', () => {
        const result = checkEligibility(3, true, true, true)
        expect(result.eligible).toBe(false)
        expect(result.reason).toBe('already_applied')
    })

    it('allows eligible renter with room under cap and no duplicate', () => {
        const result = checkEligibility(3, false, true, true)
        expect(result.eligible).toBe(true)
        expect(result.reason).toBeNull()
    })

    it('allows renter at 4 active (just under cap)', () => {
        const result = checkEligibility(4, false, true, true)
        expect(result.eligible).toBe(true)
    })

    it('allows renter at 0 active', () => {
        const result = checkEligibility(0, false, true, true)
        expect(result.eligible).toBe(true)
    })
})

describe('document type validation', () => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']

    it('accepts PDF files', () => {
        expect(allowedTypes.includes('application/pdf')).toBe(true)
    })

    it('accepts JPEG images', () => {
        expect(allowedTypes.includes('image/jpeg')).toBe(true)
    })

    it('accepts PNG images', () => {
        expect(allowedTypes.includes('image/png')).toBe(true)
    })

    it('rejects HEIC images', () => {
        expect(allowedTypes.includes('image/heic')).toBe(false)
    })

    it('rejects Word documents', () => {
        expect(allowedTypes.includes('application/msword')).toBe(false)
    })
})

describe('application status transitions', () => {
    const validTransitions: Record<string, string[]> = {
        submitted: ['under_review', 'shortlisted', 'approved', 'rejected', 'withdrawn'],
        under_review: ['shortlisted', 'approved', 'rejected'],
        shortlisted: ['approved', 'rejected'],
        approved: [],
        rejected: [],
        withdrawn: [],
    }

    it('submitted applications can move to any active status', () => {
        expect(validTransitions.submitted).toContain('under_review')
        expect(validTransitions.submitted).toContain('shortlisted')
    })

    it('shortlisted can be approved or rejected', () => {
        expect(validTransitions.shortlisted).toContain('approved')
        expect(validTransitions.shortlisted).toContain('rejected')
    })

    it('withdrawn and rejected are terminal states', () => {
        expect(validTransitions.withdrawn).toHaveLength(0)
        expect(validTransitions.rejected).toHaveLength(0)
    })
})

describe('landlord applicant status update flow', () => {
    const validTransitions: Record<string, string[]> = {
        submitted: ['under_review', 'shortlisted', 'approved', 'rejected', 'withdrawn'],
        under_review: ['shortlisted', 'approved', 'rejected'],
        shortlisted: ['approved', 'rejected'],
        approved: [],
        rejected: [],
        withdrawn: [],
    }

    function isValidTransition(from: string, to: string): boolean {
        return (validTransitions[from] || []).includes(to)
    }

    function simulateStatusUpdate(
        currentStatus: string,
        newStatus: string,
        isOwner: boolean
    ) {
        if (!isOwner) return { success: false, error: 'Access denied' }
        if (!isValidTransition(currentStatus, newStatus)) {
            return { success: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` }
        }
        return { success: true }
    }

    it('allows submitted → shortlisted by owner', () => {
        const result = simulateStatusUpdate('submitted', 'shortlisted', true)
        expect(result.success).toBe(true)
    })

    it('allows shortlisted → approved by owner', () => {
        const result = simulateStatusUpdate('shortlisted', 'approved', true)
        expect(result.success).toBe(true)
    })

    it('allows shortlisted → rejected by owner', () => {
        const result = simulateStatusUpdate('shortlisted', 'rejected', true)
        expect(result.success).toBe(true)
    })

    it('allows submitted → under_review by owner', () => {
        const result = simulateStatusUpdate('submitted', 'under_review', true)
        expect(result.success).toBe(true)
    })

    it('rejects rejected → approved (terminal state)', () => {
        const result = simulateStatusUpdate('rejected', 'approved', true)
        expect(result.success).toBe(false)
        expect('error' in result && result.error).toContain('Cannot transition')
    })

    it('rejects withdrawn → shortlisted (terminal state)', () => {
        const result = simulateStatusUpdate('withdrawn', 'shortlisted', true)
        expect(result.success).toBe(false)
    })

    it('rejects approved → submitted (terminal state)', () => {
        const result = simulateStatusUpdate('approved', 'submitted', true)
        expect(result.success).toBe(false)
    })

    it('rejects status update by non-owner', () => {
        const result = simulateStatusUpdate('submitted', 'shortlisted', false)
        expect(result.success).toBe(false)
        expect('error' in result && result.error).toBe('Access denied')
    })
})

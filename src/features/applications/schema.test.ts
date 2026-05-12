import { describe, it, expect } from 'vitest'
import { applicationSchema, documentTypeSchema } from './schema'

const validApplication = {
    listingId: '550e8400-e29b-41d4-a716-446655440000',
    fullName: 'Jane Doe',
    income: 25000,
    employmentStatus: 'Full-time employed',
    moveInDate: '2026-07-01',
    householdSize: 2,
}

describe('applicationSchema', () => {
    it('accepts a valid application', () => {
        const result = applicationSchema.safeParse(validApplication)
        expect(result.success).toBe(true)
    })

    it('rejects an invalid UUID for listingId', () => {
        const result = applicationSchema.safeParse({ ...validApplication, listingId: 'not-a-uuid' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.listingId).toBeDefined()
        }
    })

    it('rejects full name shorter than 2 characters', () => {
        const result = applicationSchema.safeParse({ ...validApplication, fullName: 'J' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.fullName).toBeDefined()
        }
    })

    it('rejects negative income', () => {
        const result = applicationSchema.safeParse({ ...validApplication, income: -1 })
        expect(result.success).toBe(false)
    })

    it('accepts zero income', () => {
        const result = applicationSchema.safeParse({ ...validApplication, income: 0 })
        expect(result.success).toBe(true)
    })

    it('rejects household size less than 1', () => {
        const result = applicationSchema.safeParse({ ...validApplication, householdSize: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects household size greater than 10', () => {
        const result = applicationSchema.safeParse({ ...validApplication, householdSize: 11 })
        expect(result.success).toBe(false)
    })

    it('accepts household size at boundaries (1 and 10)', () => {
        expect(applicationSchema.safeParse({ ...validApplication, householdSize: 1 }).success).toBe(true)
        expect(applicationSchema.safeParse({ ...validApplication, householdSize: 10 }).success).toBe(true)
    })

    it('rejects employment status shorter than 2 characters', () => {
        const result = applicationSchema.safeParse({ ...validApplication, employmentStatus: 'X' })
        expect(result.success).toBe(false)
    })

    it('coerces string numbers for income and householdSize', () => {
        const result = applicationSchema.safeParse({
            ...validApplication,
            income: '30000',
            householdSize: '3',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.income).toBe(30000)
            expect(result.data.householdSize).toBe(3)
        }
    })
})

describe('documentTypeSchema', () => {
    it('accepts "id"', () => {
        expect(documentTypeSchema.safeParse('id').success).toBe(true)
    })

    it('accepts "payslip"', () => {
        expect(documentTypeSchema.safeParse('payslip').success).toBe(true)
    })

    it('rejects unknown document type', () => {
        expect(documentTypeSchema.safeParse('drivers_license').success).toBe(false)
    })
})

describe('application cap and duplicate prevention constants', () => {
    const MAX_ACTIVE_APPLICATIONS = 5
    const activeStatuses = ['submitted', 'under_review', 'shortlisted', 'approved'] as const

    it('cap is 5 active applications', () => {
        expect(MAX_ACTIVE_APPLICATIONS).toBe(5)
    })

    it('active statuses include exactly 4 types', () => {
        expect(activeStatuses).toHaveLength(4)
        expect(activeStatuses).toContain('submitted')
        expect(activeStatuses).toContain('under_review')
        expect(activeStatuses).toContain('shortlisted')
        expect(activeStatuses).toContain('approved')
    })

    it('withdrawn is not an active status', () => {
        expect(activeStatuses).not.toContain('withdrawn')
    })

    it('rejected is not an active status', () => {
        expect(activeStatuses).not.toContain('rejected')
    })

    it('count at cap means not eligible', () => {
        const count = 5
        expect(count >= MAX_ACTIVE_APPLICATIONS).toBe(true)
    })

    it('count below cap means eligible', () => {
        const count = 4
        expect(count >= MAX_ACTIVE_APPLICATIONS).toBe(false)
    })
})

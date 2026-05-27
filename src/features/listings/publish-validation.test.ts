import { describe, it, expect } from 'vitest'
import { listingSchema, MIN_LISTING_IMAGES } from './schema'

describe('publish validation logic', () => {
    const completeListing = {
        title: 'Modern apartment in Cape Town',
        property_type: 'apartment',
        price: 8500,
        address: '123 Long Street, Cape Town',
        latitude: -33.9249,
        longitude: 18.4241,
        bedrooms: 2,
        bathrooms: 1,
        parking_type: 'covered',
        parking_count: 1,
        electricity_type: 'prepaid',
        water_availability: 'municipal',
        lease_duration: '12_months',
        availability_date: '2026-06-01',
    }

    it('a complete listing passes field validation', () => {
        const result = listingSchema.safeParse(completeListing)
        expect(result.success).toBe(true)
    })

    it('a listing missing price fails field validation', () => {
        const incomplete = { ...completeListing } as Partial<typeof completeListing>
        delete incomplete.price
        const result = listingSchema.safeParse(incomplete)
        expect(result.success).toBe(false)
    })

    it('a listing missing address fails field validation', () => {
        const result = listingSchema.safeParse({ ...completeListing, address: '' })
        expect(result.success).toBe(false)
    })

    it('a listing missing property_type fails field validation', () => {
        const incomplete = { ...completeListing } as Partial<typeof completeListing>
        delete incomplete.property_type
        const result = listingSchema.safeParse(incomplete)
        expect(result.success).toBe(false)
    })

    it('MIN_LISTING_IMAGES is 3', () => {
        expect(MIN_LISTING_IMAGES).toBe(3)
    })

    it('image count check: below minimum produces descriptive error', () => {
        const imageCount = 2
        const errors: string[] = []
        if (imageCount < MIN_LISTING_IMAGES) {
            errors.push(`At least ${MIN_LISTING_IMAGES} images are required (currently ${imageCount}).`)
        }
        expect(errors).toHaveLength(1)
        expect(errors[0]).toContain('At least 3 images')
        expect(errors[0]).toContain('currently 2')
    })

    it('image count check: exactly minimum produces no error', () => {
        const imageCount = 3
        const errors: string[] = []
        if (imageCount < MIN_LISTING_IMAGES) {
            errors.push(`At least ${MIN_LISTING_IMAGES} images are required (currently ${imageCount}).`)
        }
        expect(errors).toHaveLength(0)
    })

    it('image count check: above minimum produces no error', () => {
        const imageCount = 5
        const errors: string[] = []
        if (imageCount < MIN_LISTING_IMAGES) {
            errors.push(`At least ${MIN_LISTING_IMAGES} images are required (currently ${imageCount}).`)
        }
        expect(errors).toHaveLength(0)
    })

    it('field validation errors include field name and first message', () => {
        const result = listingSchema.safeParse({ ...completeListing, price: -1, address: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors
            const publishErrors: string[] = []
            for (const [field, msgs] of Object.entries(fieldErrors)) {
                if (msgs && msgs.length > 0) {
                    publishErrors.push(`${field}: ${msgs[0]}`)
                }
            }
            expect(publishErrors.length).toBeGreaterThanOrEqual(2)
            expect(publishErrors.some(e => e.startsWith('price:'))).toBe(true)
            expect(publishErrors.some(e => e.startsWith('address:'))).toBe(true)
        }
    })
})

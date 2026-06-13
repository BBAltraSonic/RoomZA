import { describe, it, expect } from 'vitest'
import {
    listingSchema,
    MIN_LISTING_IMAGES,
    parkingTypes,
    electricityTypes,
    waterTypes,
    leaseDurations,
    propertyTypes,
} from './schema'

const validListing = {
    title: 'Modern apartment in Cape Town',
    description: 'A beautiful 2-bed apartment',
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

describe('listingSchema', () => {
    it('accepts a valid listing with all required fields', () => {
        const result = listingSchema.safeParse(validListing)
        expect(result.success).toBe(true)
    })

    it('rejects title shorter than 3 characters', () => {
        const result = listingSchema.safeParse({ ...validListing, title: 'Ab' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.title).toBeDefined()
        }
    })

    it('rejects title longer than 120 characters', () => {
        const result = listingSchema.safeParse({ ...validListing, title: 'A'.repeat(121) })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.title).toBeDefined()
        }
    })

    it('rejects missing address (empty string)', () => {
        const result = listingSchema.safeParse({ ...validListing, address: '' })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.address).toBeDefined()
        }
    })

    it('rejects zero price', () => {
        const result = listingSchema.safeParse({ ...validListing, price: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects negative price', () => {
        const result = listingSchema.safeParse({ ...validListing, price: -100 })
        expect(result.success).toBe(false)
    })

    it('rejects non-integer price', () => {
        const result = listingSchema.safeParse({ ...validListing, price: 8500.50 })
        expect(result.success).toBe(false)
    })

    it('rejects invalid property type', () => {
        const result = listingSchema.safeParse({ ...validListing, property_type: 'mansion' })
        expect(result.success).toBe(false)
    })

    it('accepts all valid property types', () => {
        for (const pt of propertyTypes) {
            const result = listingSchema.safeParse({ ...validListing, property_type: pt })
            expect(result.success).toBe(true)
        }
    })

    it('rejects latitude below -90', () => {
        const result = listingSchema.safeParse({ ...validListing, latitude: -91 })
        expect(result.success).toBe(false)
    })

    it('rejects latitude above 90', () => {
        const result = listingSchema.safeParse({ ...validListing, latitude: 91 })
        expect(result.success).toBe(false)
    })

    it('rejects longitude below -180', () => {
        const result = listingSchema.safeParse({ ...validListing, longitude: -181 })
        expect(result.success).toBe(false)
    })

    it('rejects longitude above 180', () => {
        const result = listingSchema.safeParse({ ...validListing, longitude: 181 })
        expect(result.success).toBe(false)
    })

    it('rejects negative bedrooms', () => {
        const result = listingSchema.safeParse({ ...validListing, bedrooms: -1 })
        expect(result.success).toBe(false)
    })

    it('rejects negative bathrooms', () => {
        const result = listingSchema.safeParse({ ...validListing, bathrooms: -1 })
        expect(result.success).toBe(false)
    })

    it('rejects missing availability date', () => {
        const result = listingSchema.safeParse({ ...validListing, availability_date: '' })
        expect(result.success).toBe(false)
    })

    it('accepts all valid parking types', () => {
        for (const pt of parkingTypes) {
            const result = listingSchema.safeParse({ ...validListing, parking_type: pt })
            expect(result.success).toBe(true)
        }
    })

    it('accepts all valid electricity types', () => {
        for (const et of electricityTypes) {
            const result = listingSchema.safeParse({ ...validListing, electricity_type: et })
            expect(result.success).toBe(true)
        }
    })

    it('accepts all valid water types', () => {
        for (const wt of waterTypes) {
            const result = listingSchema.safeParse({ ...validListing, water_availability: wt })
            expect(result.success).toBe(true)
        }
    })

    it('accepts all valid lease durations', () => {
        for (const ld of leaseDurations) {
            const result = listingSchema.safeParse({ ...validListing, lease_duration: ld })
            expect(result.success).toBe(true)
        }
    })

    it('coerces string numbers for price, bedrooms, bathrooms', () => {
        const result = listingSchema.safeParse({
            ...validListing,
            price: '9000',
            bedrooms: '3',
            bathrooms: '2',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.price).toBe(9000)
            expect(result.data.bedrooms).toBe(3)
            expect(result.data.bathrooms).toBe(2)
        }
    })

    it('accepts optional monthly cost fields and coerces them', () => {
        const result = listingSchema.safeParse({
            ...validListing,
            electricity_included: 'false',
            electricity_estimate: '850',
            water_included: 'true',
            water_estimate: '',
            wifi_available: 'true',
            wifi_included: 'false',
            wifi_estimate: '699',
            parking_included: '',
            parking_estimate: '500',
            security_fee_estimate: '450',
        })

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.electricity_included).toBe(false)
            expect(result.data.electricity_estimate).toBe(850)
            expect(result.data.water_included).toBe(true)
            expect(result.data.water_estimate).toBeNull()
            expect(result.data.parking_included).toBeNull()
            expect(result.data.security_fee_estimate).toBe(450)
        }
    })

    it('rejects negative monthly cost estimates', () => {
        const result = listingSchema.safeParse({
            ...validListing,
            wifi_estimate: '-1',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.wifi_estimate).toBeDefined()
        }
    })
})

describe('MIN_LISTING_IMAGES', () => {
    it('is 3', () => {
        expect(MIN_LISTING_IMAGES).toBe(3)
    })
})

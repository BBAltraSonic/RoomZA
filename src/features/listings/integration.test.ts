import { describe, it, expect } from 'vitest'
import { listingSchema, MIN_LISTING_IMAGES, amenitiesSchema, emptyAmenities } from './schema'

/**
 * Integration tests for listing server action flows.
 * Tests the validation + business logic paths without actual Supabase calls.
 */

describe('createListing validation flow', () => {
    function simulateCreateListing(formEntries: Record<string, string>) {
        const raw = formEntries
        const parsed = listingSchema.safeParse(raw)

        if (!parsed.success) {
            return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
        }

        // Parse amenities metadata
        let metadata: Record<string, unknown> = {}
        const rawMetadata = formEntries['metadata']
        if (typeof rawMetadata === 'string' && rawMetadata.trim().length > 0) {
            try {
                const parsed_meta = JSON.parse(rawMetadata)
                const amenitiesResult = amenitiesSchema.safeParse(parsed_meta.amenities)
                metadata = { amenities: amenitiesResult.success ? amenitiesResult.data : emptyAmenities }
            } catch {
                metadata = { amenities: emptyAmenities }
            }
        }

        return { success: true, data: parsed.data, metadata }
    }

    it('validates and parses a complete listing form', () => {
        const result = simulateCreateListing({
            title: 'Test Listing',
            property_type: 'apartment',
            price: '8000',
            address: '123 Test Street',
            latitude: '-33.9',
            longitude: '18.4',
            bedrooms: '2',
            bathrooms: '1',
            parking_type: 'covered',
            parking_count: '1',
            electricity_type: 'prepaid',
            water_availability: 'municipal',
            electricity_included: 'false',
            electricity_estimate: '850',
            water_included: 'true',
            water_estimate: '',
            wifi_available: 'true',
            wifi_included: 'false',
            wifi_estimate: '699',
            parking_included: 'true',
            parking_estimate: '',
            security_fee_estimate: '450',
            lease_duration: '12_months',
            availability_date: '2026-06-01',
            metadata: JSON.stringify({ amenities: { essentials: ['wifi'], security: [], lifestyle: [], appliances: [] } }),
        })
        expect(result.success).toBe(true)
        if ('data' in result) {
            expect(result.data?.price).toBe(8000)
            expect(result.data?.electricity_estimate).toBe(850)
            expect(result.data?.water_included).toBe(true)
            expect(result.data?.water_estimate).toBeNull()
            expect(result.data?.wifi_available).toBe(true)
            expect(result.data?.security_fee_estimate).toBe(450)
            expect(result.metadata?.amenities).toEqual({
                essentials: ['wifi'],
                security: [],
                lifestyle: [],
                appliances: [],
            })
        }
    })

    it('returns field errors for invalid form data', () => {
        const result = simulateCreateListing({
            title: '',
            property_type: 'invalid',
            price: '-1',
            address: '',
            latitude: '200',
            longitude: '200',
            bedrooms: '-1',
            bathrooms: '-1',
            parking_type: 'flying_car',
            parking_count: '-1',
            electricity_type: 'fusion',
            water_availability: 'rain_dance',
            lease_duration: 'forever',
            availability_date: '',
        })
        expect(result.success).toBe(false)
        if ('errors' in result) {
            expect(result.errors?.title).toBeDefined()
            expect(result.errors?.address).toBeDefined()
            expect(result.errors?.price).toBeDefined()
        }
    })

    it('falls back to emptyAmenities for invalid metadata JSON', () => {
        const result = simulateCreateListing({
            title: 'Test Listing',
            property_type: 'apartment',
            price: '8000',
            address: '123 Test Street',
            latitude: '-33.9',
            longitude: '18.4',
            bedrooms: '2',
            bathrooms: '1',
            parking_type: 'covered',
            parking_count: '1',
            electricity_type: 'prepaid',
            water_availability: 'municipal',
            lease_duration: '12_months',
            availability_date: '2026-06-01',
            metadata: '{invalid json',
        })
        expect(result.success).toBe(true)
        if ('metadata' in result) {
            expect(result.metadata?.amenities).toEqual(emptyAmenities)
        }
    })
})

describe('publishListing validation flow', () => {
    function simulatePublishValidation(listing: Record<string, unknown>, imageCount: number) {
        const fieldResult = listingSchema.safeParse(listing)
        const errors: string[] = []

        if (!fieldResult.success) {
            const fieldErrors = fieldResult.error.flatten().fieldErrors
            for (const [field, msgs] of Object.entries(fieldErrors)) {
                if (msgs && msgs.length > 0) {
                    errors.push(`${field}: ${msgs[0]}`)
                }
            }
        }

        if (imageCount < MIN_LISTING_IMAGES) {
            errors.push(`At least ${MIN_LISTING_IMAGES} images are required (currently ${imageCount}).`)
        }

        return errors.length > 0 ? { success: false, errors } : { success: true }
    }

    it('fails when listing has no title and 0 images', () => {
        const result = simulatePublishValidation({ price: 5000, address: 'x', property_type: 'room' }, 0)
        expect(result.success).toBe(false)
        if ('errors' in result) {
            expect(result.errors?.some((e: string) => e.includes('images'))).toBe(true)
        }
    })

    it('passes when listing is complete and has 3+ images', () => {
        const result = simulatePublishValidation({
            title: 'Great Place',
            property_type: 'apartment',
            price: 5000,
            address: '123 Main',
            latitude: -33,
            longitude: 18,
            bedrooms: 1,
            bathrooms: 1,
            parking_type: 'none',
            parking_count: 0,
            electricity_type: 'prepaid',
            water_availability: 'municipal',
            lease_duration: '12_months',
            availability_date: '2026-07-01',
        }, 3)
        expect(result.success).toBe(true)
    })

    it('fails with exactly 2 images even if listing is complete', () => {
        const result = simulatePublishValidation({
            title: 'Great Place',
            property_type: 'apartment',
            price: 5000,
            address: '123 Main',
            latitude: -33,
            longitude: 18,
            bedrooms: 1,
            bathrooms: 1,
            parking_type: 'none',
            parking_count: 0,
            electricity_type: 'prepaid',
            water_availability: 'municipal',
            lease_duration: '12_months',
            availability_date: '2026-07-01',
        }, 2)
        expect(result.success).toBe(false)
        if ('errors' in result) {
            expect(result.errors).toHaveLength(1)
            expect(result.errors?.[0]).toContain('At least 3')
        }
    })
})

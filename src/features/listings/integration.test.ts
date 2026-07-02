import { beforeEach, describe, it, expect, vi } from 'vitest'
import { listingSchema, MIN_LISTING_IMAGES, amenitiesSchema, emptyAmenities } from './schema'
import { validateImageUpload, validateListingImageCount } from './types'

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    requireRole: vi.fn(),
    revalidatePath: vi.fn(),
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
    requireRole: (role: string) => mocks.requireRole(role),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (path: string) => mocks.revalidatePath(path),
}))

vi.mock('@/lib/logger', () => ({
    logger: mocks.logger,
}))

import { createListing } from './actions'

/**
 * Integration tests for listing server action flows.
 * Tests the validation + business logic paths without actual Supabase calls.
 */

function validListingForm(overrides: Record<string, string> = {}) {
    const values = {
        title: 'Test Listing',
        description: 'A well described listing.',
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
        availability_date: '2026-07-01',
        metadata: JSON.stringify({ amenities: { essentials: ['wifi'], security: [], lifestyle: [], appliances: [] } }),
        ...overrides,
    }

    const form = new FormData()
    for (const [key, value] of Object.entries(values)) {
        form.set(key, value)
    }
    return form
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockResolvedValue({ user: { id: 'landlord-1' } })
})

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

describe('createListing server action flow', () => {
    it('creates a draft listing through the checked RPC and confirms the listing id', async () => {
        let rpcPayload: Record<string, unknown> | null = null
        const rpc = vi.fn(async (_name: string, payload: Record<string, unknown>) => {
            rpcPayload = payload
            return {
                data: [{ listing_id: 'listing-1', result: 'created' }],
                error: null,
            }
        })
        mocks.createClient.mockResolvedValue({ rpc })

        const startedAt = performance.now()
        const result = await createListing(validListingForm())
        const elapsedMs = performance.now() - startedAt

        expect(result).toEqual({ success: true, data: { listingId: 'listing-1' } })
        expect(elapsedMs).toBeLessThan(3000)
        expect(rpc).toHaveBeenCalledWith('create_listing_checked', expect.objectContaining({
            title: 'Test Listing',
            price: 8000,
            latitude: -33.9,
            longitude: 18.4,
            metadata: {
                amenities: {
                    essentials: ['wifi'],
                    security: [],
                    lifestyle: [],
                    appliances: [],
                },
            },
        }))
        expect(rpcPayload).not.toHaveProperty('landlord_id')
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard')
    })

    it('returns field errors and does not call Supabase when validation fails', async () => {
        const rpc = vi.fn()
        mocks.createClient.mockResolvedValue({ rpc })

        const result = await createListing(validListingForm({ title: '', address: '', price: '-1' }))

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.details?.fieldErrors.title).toBeDefined()
            expect(result.details?.fieldErrors.address).toBeDefined()
            expect(result.details?.fieldErrors.price).toBeDefined()
        }
        expect(mocks.createClient).not.toHaveBeenCalled()
        expect(rpc).not.toHaveBeenCalled()
    })

    it('maps RPC timeout to an explicit create failure', async () => {
        mocks.createClient.mockResolvedValue({
            rpc: vi.fn(async () => ({
                data: [{ listing_id: null, result: 'timeout' }],
                error: null,
            })),
        })

        const result = await createListing(validListingForm())

        expect(result).toEqual({
            success: false,
            error: 'Listing creation took too long.',
            details: { fieldErrors: { _form: ['Listing creation took too long. Try again.'] } },
        })
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

describe('uploadListingImage bounds flow', () => {
    function simulateUpload(existingImageCount: number, file: { type: string; size: number }) {
        const countResult = validateListingImageCount(existingImageCount, 1)
        if (!countResult.valid) return { success: false, error: countResult.error }

        const fileResult = validateImageUpload(file.type, file.size)
        if (!fileResult.valid) return { success: false, error: fileResult.error }

        return { success: true }
    }

    it('accepts a supported image while the listing remains within 20 images', () => {
        const result = simulateUpload(19, { type: 'image/webp', size: 10 * 1024 * 1024 })
        expect(result.success).toBe(true)
    })

    it('rejects the total image count bound before storage', () => {
        const result = simulateUpload(20, { type: 'image/jpeg', size: 1024 })
        expect(result.success).toBe(false)
        if (!result.success) expect(result.error).toContain('20 total')
    })

    it('rejects unsupported image types and oversize files with the violated bound', () => {
        expect(simulateUpload(0, { type: 'image/gif', size: 1024 })).toEqual({
            success: false,
            error: 'Only JPEG, PNG, and WebP images are allowed.',
        })
        expect(simulateUpload(0, { type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toEqual({
            success: false,
            error: 'Image must be smaller than 10 MB.',
        })
    })
})

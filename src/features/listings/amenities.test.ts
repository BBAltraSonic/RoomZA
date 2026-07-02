import { describe, it, expect } from 'vitest'
import {
    amenitiesSchema,
    emptyAmenities,
    amenityCategories,
    amenityLabels,
    type AmenitiesData,
} from './schema'

describe('amenitiesSchema', () => {
    it('accepts a fully valid amenities object', () => {
        const valid: AmenitiesData = {
            essentials: ['wifi', 'pet_friendly'],
            security: ['cctv', 'gated_complex'],
            lifestyle: ['pool', 'braai_area'],
            appliances: ['washing_machine', 'fridge'],
        }
        const result = amenitiesSchema.safeParse(valid)
        expect(result.success).toBe(true)
    })

    it('defaults empty arrays for missing categories', () => {
        const result = amenitiesSchema.safeParse({})
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.essentials).toEqual([])
            expect(result.data.security).toEqual([])
            expect(result.data.lifestyle).toEqual([])
            expect(result.data.appliances).toEqual([])
        }
    })

    it('rejects an unknown amenity value in essentials', () => {
        const result = amenitiesSchema.safeParse({
            essentials: ['wifi', 'teleporter'],
        })
        expect(result.success).toBe(false)
    })

    it('rejects an unknown amenity value in security', () => {
        const result = amenitiesSchema.safeParse({
            security: ['laser_grid'],
        })
        expect(result.success).toBe(false)
    })

    it('rejects an unknown amenity value in lifestyle', () => {
        const result = amenitiesSchema.safeParse({
            lifestyle: ['helipad'],
        })
        expect(result.success).toBe(false)
    })

    it('rejects an unknown amenity value in appliances', () => {
        const result = amenitiesSchema.safeParse({
            appliances: ['robot_butler'],
        })
        expect(result.success).toBe(false)
    })

    it('accepts all defined essentials items', () => {
        const result = amenitiesSchema.safeParse({
            essentials: [...amenityCategories.essentials.items],
        })
        expect(result.success).toBe(true)
    })

    it('accepts all defined security items', () => {
        const result = amenitiesSchema.safeParse({
            security: [...amenityCategories.security.items],
        })
        expect(result.success).toBe(true)
    })

    it('accepts all defined lifestyle items', () => {
        const result = amenitiesSchema.safeParse({
            lifestyle: [...amenityCategories.lifestyle.items],
        })
        expect(result.success).toBe(true)
    })

    it('accepts all defined appliances items', () => {
        const result = amenitiesSchema.safeParse({
            appliances: [...amenityCategories.appliances.items],
        })
        expect(result.success).toBe(true)
    })
})

describe('emptyAmenities', () => {
    it('has correct shape with all empty arrays', () => {
        expect(emptyAmenities).toEqual({
            essentials: [],
            security: [],
            lifestyle: [],
            appliances: [],
        })
    })
})

describe('amenityLabels', () => {
    it('has a label for every amenity across all categories', () => {
        for (const category of Object.values(amenityCategories)) {
            for (const item of category.items) {
                const label = amenityLabels[item];
                expect(label).toBeDefined()
                expect(typeof label).toBe('string')
                expect((label ?? '').length).toBeGreaterThan(0)
            }
        }
    })
})

describe('amenities metadata parsing (replicates server action logic)', () => {
    function parseAmenitiesFromMetadata(rawMetadata: string | null): AmenitiesData {
        if (typeof rawMetadata !== 'string' || rawMetadata.trim().length === 0) {
            return emptyAmenities
        }
        try {
            const parsed = JSON.parse(rawMetadata)
            const result = amenitiesSchema.safeParse(parsed.amenities)
            return result.success ? result.data : emptyAmenities
        } catch {
            return emptyAmenities
        }
    }

    it('parses valid JSON metadata with amenities', () => {
        const raw = JSON.stringify({ amenities: { essentials: ['wifi'], security: [], lifestyle: [], appliances: [] } })
        const result = parseAmenitiesFromMetadata(raw)
        expect(result.essentials).toEqual(['wifi'])
    })

    it('returns empty amenities for invalid JSON', () => {
        const result = parseAmenitiesFromMetadata('not-json{{{')
        expect(result).toEqual(emptyAmenities)
    })

    it('returns empty amenities for null', () => {
        const result = parseAmenitiesFromMetadata(null)
        expect(result).toEqual(emptyAmenities)
    })

    it('returns empty amenities for empty string', () => {
        const result = parseAmenitiesFromMetadata('')
        expect(result).toEqual(emptyAmenities)
    })

    it('returns empty amenities when amenities field has invalid values', () => {
        const raw = JSON.stringify({ amenities: { essentials: ['teleporter'] } })
        const result = parseAmenitiesFromMetadata(raw)
        expect(result).toEqual(emptyAmenities)
    })

    it('returns empty amenities when metadata has no amenities key', () => {
        const raw = JSON.stringify({ other: 'data' })
        const result = parseAmenitiesFromMetadata(raw)
        expect(result).toEqual(emptyAmenities)
    })
})

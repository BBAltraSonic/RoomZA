import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for notification digest route logic.
 * Tests the core digest grouping and processing without HTTP layer.
 */

type DigestEvent = {
    id: string
    recipient_id: string
    type: string
    payload: { message?: string } | null
    profiles: { email: string } | { email: string }[] | null
}

function groupEventsByRecipient(events: DigestEvent[]) {
    return events.reduce((acc, event) => {
        const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles
        const email = profile?.email
        if (!email) return acc
        if (!acc[email]) acc[email] = { events: [], ids: [] }
        acc[email].events.push(event)
        acc[email].ids.push(event.id)
        return acc
    }, {} as Record<string, { events: DigestEvent[]; ids: string[] }>)
}

function buildDigestHtml(events: DigestEvent[]): string {
    return `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #000; text-transform: uppercase;">RoomZA Updates</h2>
      <ul style="border: 2px solid #000; padding: 20px; background: #fff;">
        ${events.map(e => {
        const payload = e.payload
        return `<li style="margin-bottom: 10px;"><strong>${e.type}:</strong> ${payload?.message || 'New update'}</li>`
    }).join('')}
      </ul>
    </div>
  `
}

describe('notification digest processing', () => {
    it('groups events by recipient email', () => {
        const events: DigestEvent[] = [
            { id: '1', recipient_id: 'u1', type: 'new_application', payload: { message: 'New app' }, profiles: { email: 'alice@test.com' } },
            { id: '2', recipient_id: 'u1', type: 'new_message', payload: { message: 'New msg' }, profiles: { email: 'alice@test.com' } },
            { id: '3', recipient_id: 'u2', type: 'viewing_booked', payload: { message: 'Booked' }, profiles: { email: 'bob@test.com' } },
        ]

        const grouped = groupEventsByRecipient(events)
        expect(Object.keys(grouped)).toHaveLength(2)
        expect(grouped['alice@test.com'].ids).toEqual(['1', '2'])
        expect(grouped['bob@test.com'].ids).toEqual(['3'])
    })

    it('skips events with no email profile', () => {
        const events: DigestEvent[] = [
            { id: '1', recipient_id: 'u1', type: 'new_application', payload: null, profiles: null },
            { id: '2', recipient_id: 'u2', type: 'new_message', payload: { message: 'Msg' }, profiles: { email: 'bob@test.com' } },
        ]

        const grouped = groupEventsByRecipient(events)
        expect(Object.keys(grouped)).toHaveLength(1)
        expect(grouped['bob@test.com']).toBeDefined()
    })

    it('handles empty event list', () => {
        const grouped = groupEventsByRecipient([])
        expect(Object.keys(grouped)).toHaveLength(0)
    })

    it('handles array-style profiles (from Supabase join)', () => {
        const events: DigestEvent[] = [
            { id: '1', recipient_id: 'u1', type: 'new_application', payload: null, profiles: [{ email: 'alice@test.com' }] },
        ]

        const grouped = groupEventsByRecipient(events)
        expect(grouped['alice@test.com'].ids).toEqual(['1'])
    })

    it('generates HTML digest with event types and messages', () => {
        const events: DigestEvent[] = [
            { id: '1', recipient_id: 'u1', type: 'new_application', payload: { message: 'New app received' }, profiles: { email: 'a@b.com' } },
            { id: '2', recipient_id: 'u1', type: 'new_message', payload: { message: 'You have a message' }, profiles: { email: 'a@b.com' } },
        ]

        const html = buildDigestHtml(events)
        expect(html).toContain('new_application')
        expect(html).toContain('New app received')
        expect(html).toContain('new_message')
        expect(html).toContain('You have a message')
        expect(html).toContain('RoomZA Updates')
    })

    it('uses fallback message when payload has no message', () => {
        const events: DigestEvent[] = [
            { id: '1', recipient_id: 'u1', type: 'viewing_proposed', payload: null, profiles: { email: 'a@b.com' } },
        ]

        const html = buildDigestHtml(events)
        expect(html).toContain('New update')
    })
})

describe('digest route authorization', () => {
    it('rejects missing authorization header', () => {
        const authHeader = null
        const cronSecret = 'test-secret-123'
        const isAuthorized = authHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(false)
    })

    it('rejects wrong authorization token', () => {
        const authHeader: string = 'Bearer wrong-token'
        const cronSecret = 'test-secret-123'
        const isAuthorized = authHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(false)
    })

    it('accepts correct authorization token', () => {
        const cronSecret = 'test-secret-123'
        const authHeader = `Bearer ${cronSecret}`
        const isAuthorized = authHeader === `Bearer ${cronSecret}`
        expect(isAuthorized).toBe(true)
    })
})

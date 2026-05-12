import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/features/notifications/send'
import type { Json } from '@/lib/supabase/types'

type DigestEvent = {
    id: string
    recipient_id: string
    type: string
    payload: Json
    profiles: { email: string } | { email: string }[] | null
}

type DigestPayload = {
    message?: string
}

export async function POST(request: Request) {
    // Validate standard cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role admin client since we are in a cron context
    const supabase = createClient()

    // Find all unsent notification events that need a digest
    const { data: events, error } = await supabase
        .from('notification_events')
        .select('id, recipient_id, type, payload, profiles!inner(email)')
        .is('sent_at', null)
        .is('digest_at', null)

    if (error || !events) {
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    if (events.length === 0) {
        return NextResponse.json({ success: true, message: 'No events to process' })
    }

    // Group by recipient email
    const userDigests = (events as DigestEvent[]).reduce((acc, event) => {
        // Note: profile comes from a to-one join, should be single object
        const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles
        const email = profile?.email

        if (!email) return acc

        if (!acc[email]) acc[email] = { events: [], ids: [] }
        acc[email].events.push(event)
        acc[email].ids.push(event.id)
        return acc
    }, {} as Record<string, { events: DigestEvent[], ids: string[] }>)

    // Send digests
    for (const [email, userObj] of Object.entries(userDigests)) {
        const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #000; text-transform: uppercase;">RoomZA Updates</h2>
        <ul style="border: 2px solid #000; padding: 20px; background: #fff;">
          ${userObj.events.map(e => {
            const payload = e.payload as DigestPayload | null
            return `<li style="margin-bottom: 10px;"><strong>${e.type}:</strong> ${payload?.message || 'New update'}</li>`
          }).join('')}
        </ul>
      </div>
    `
        const result = await sendEmail(email, 'Your RoomZA Digest', htmlContent)

        if (!result.error) {
            await supabase
                .from('notification_events')
                .update({ digest_at: new Date().toISOString() })
                .in('id', userObj.ids)
        }
    }

    return NextResponse.json({ success: true, processed: events.length })
}

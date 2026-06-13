import { apiFailure, apiSuccess, getRequestId } from '@/lib/api'
import { logger } from '@/lib/logger'
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
    const requestId = getRequestId(request)
    // Validate standard cron secret
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return apiFailure({ code: 'unauthorized', message: 'Unauthorized' }, 401, { requestId })
    }

    // Use service role admin client since we are in a cron context
    const supabase = createClient()

    // Find all unsent notification events that need a digest
    const { data: events, error } = await supabase
        .from('notification_events')
        .select('id, recipient_id, type, payload, profiles!inner(email)')
        .is('sent_at', null)
        .is('digest_at', null)
        .is('locked_at', null)
        .lte('next_attempt_at', new Date().toISOString())

    if (error || !events) {
        logger.error('Notification digest fetch failed', { requestId, error })
        return apiFailure({ code: 'server_error', message: 'Failed to fetch events' }, 500, { requestId })
    }

    if (events.length === 0) {
        return apiSuccess({ success: true, message: 'No events to process' }, { requestId })
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
        } else {
            logger.error('Notification digest send failed', { requestId, error: result.error })
            await supabase
                .from('notification_events')
                .update({
                    attempt_count: 1,
                    last_error: String(result.error instanceof Error ? result.error.message : result.error),
                    next_attempt_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                })
                .in('id', userObj.ids)
        }
    }

    return apiSuccess({ success: true, processed: events.length }, { requestId })
}

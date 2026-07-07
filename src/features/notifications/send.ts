import { Resend } from 'resend'
import { logger } from '@/lib/logger'

const FALLBACK_FROM_EMAIL = 'notifications@roomza.app'

export type EmailConfigStatus = {
    configured: boolean
    hasApiKey: boolean
    hasFromEmail: boolean
    fromEmail: string
    usingFallbackFrom: boolean
}

/**
 * Reports whether transactional email delivery is configured, without ever
 * exposing the API key. Used by the ops diagnostic (`npm run email:check`) and
 * safe to log because it contains no secrets.
 */
export function getEmailConfigStatus(): EmailConfigStatus {
    const hasApiKey = Boolean(process.env.RESEND_API_KEY)
    const configuredFrom = process.env.RESEND_FROM_EMAIL
    const hasFromEmail = Boolean(configuredFrom)

    return {
        configured: hasApiKey,
        hasApiKey,
        hasFromEmail,
        fromEmail: configuredFrom || FALLBACK_FROM_EMAIL,
        usingFallbackFrom: !hasFromEmail,
    }
}

export async function sendEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        // Fail loud (in logs) but not to the caller's users: a missing key is an
        // operator misconfiguration, not something to surface via the UI. Before
        // this log, a missing key made the whole email pipeline a silent no-op.
        logger.error('Email not sent: RESEND_API_KEY is not configured', { subject })
        return { error: new Error('RESEND_API_KEY is not configured') }
    }

    const from = process.env.RESEND_FROM_EMAIL || FALLBACK_FROM_EMAIL
    if (!process.env.RESEND_FROM_EMAIL) {
        logger.warn('RESEND_FROM_EMAIL is not set; using fallback sender', { from, subject })
    }

    const resend = new Resend(apiKey)

    try {
        const { data, error } = await resend.emails.send({
            from,
            to,
            subject,
            html,
        })

        if (error) {
            logger.error('Resend API error', { error, from, to, subject })
            return { error }
        }

        return { data }
    } catch (error) {
        logger.error('Email send error', { error, from, to, subject })
        return { error }
    }
}

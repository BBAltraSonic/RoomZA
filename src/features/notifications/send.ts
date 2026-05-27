import { Resend } from 'resend'
import { logger } from '@/lib/logger'

export async function sendEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
        return { error: new Error('RESEND_API_KEY is not configured') }
    }

    const resend = new Resend(apiKey)

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'notifications@roomza.app',
            to,
            subject,
            html,
        })

        if (error) {
            logger.error('Resend API error', { error })
            return { error }
        }

        return { data }
    } catch (error) {
        logger.error('Email send error', { error })
        return { error }
    }
}

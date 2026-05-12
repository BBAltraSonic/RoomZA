import { Resend } from 'resend'

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
            console.error('Resend API Error:', error)
            return { error }
        }

        return { data }
    } catch (error) {
        console.error('Email Send Error:', error)
        return { error }
    }
}

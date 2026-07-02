import { processNotificationDigest } from '@/features/notifications/jobs'
import { apiFailure, apiSuccess, getRequestId } from '@/lib/api'

export async function POST(request: Request) {
    const requestId = getRequestId(request)
    // Validate standard cron secret
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return apiFailure({ code: 'unauthorized', message: 'Unauthorized' }, 401, { requestId })
    }

    const result = await processNotificationDigest(requestId)
    if (!result.success) {
        return apiFailure({ code: result.code, message: result.message }, result.httpStatus, { requestId })
    }

    return apiSuccess({ success: true, message: result.message, processed: result.processed }, { requestId })
}

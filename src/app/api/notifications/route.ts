import { handleNotificationApi } from "@/features/notifications/api";
export const GET = (request:Request) => handleNotificationApi(request);
export const PATCH = (request:Request) => handleNotificationApi(request);

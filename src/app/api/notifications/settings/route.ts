import { handleNotificationApi } from "@/features/notifications/api";
export const GET = (request:Request) => handleNotificationApi(request,"settings");
export const PATCH = (request:Request) => handleNotificationApi(request,"settings");

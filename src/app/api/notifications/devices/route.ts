import { handleNotificationApi } from "@/features/notifications/api";
export const GET = (request:Request) => handleNotificationApi(request,"devices");
export const POST = (request:Request) => handleNotificationApi(request,"devices");
export const DELETE = (request:Request) => handleNotificationApi(request,"devices");

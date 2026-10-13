import { createHash,timingSafeEqual } from "node:crypto";
import { createUntypedClient } from "@/lib/supabase/admin";
import { processNotificationJob } from "@/features/notifications/jobs";
import { getRequestId } from "@/lib/api";
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 const expected=createHash("sha256").update("Bearer "+(secret??"")).digest();
 const supplied=createHash("sha256").update(request.headers.get("authorization")??"").digest();
 if(!secret||!timingSafeEqual(expected,supplied))return Response.json({error:"Unauthorized"},{status:401});
 const client=createUntypedClient();
 const {data,error}=await client.rpc("notifications_claim_email",{batch_size:20});
 if(error)return Response.json({error:"Dispatch unavailable"},{status:503});
 const requestId=getRequestId(request);
 let processed=0;
 for(const id of (data??[]) as string[]){
  const result=await processNotificationJob(id,requestId);if(result.sent)processed++;
 }
 return Response.json({processed},{headers:{"Cache-Control":"no-store"}});
}

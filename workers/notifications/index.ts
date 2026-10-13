import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { notificationForDisplay, type NotificationInboxRow } from "../../src/features/notifications/inbox-contract";
import { isAllowedPushEndpoint } from "../../src/features/notifications/contract";
import { logger } from "../../src/lib/logger";
type Delivery={id:string;leaseToken:string;accountId:string;attempt:number;previews:boolean;event:NotificationInboxRow;subscription:Omit<PushSubscription,"expirationTime">};
async function rpc<T>(env:NotificationWorkerEnv,name:string,args:unknown={}):Promise<T>{
 const response=await fetch(env.NOTIFICATION_SUPABASE_URL+"/rest/v1/rpc/"+name,{method:"POST",
  headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json"},
  body:JSON.stringify(args),signal:AbortSignal.timeout(15000),redirect:"error"});
 if(!response.ok)throw new Error("notification_rpc_"+response.status);
 return response.json() as Promise<T>;
}
export function pushContent(delivery:Pick<Delivery,"event"|"previews"|"accountId">){
 const item=notificationForDisplay(delivery.event);
 return {id:item.id,accountId:delivery.accountId,title:delivery.previews?item.title:"Pinpoint update",
  body:delivery.previews?item.message.slice(0,220):"You have a new update. Open Pinpoint to view it.",href:item.href??"/profile/notifications"};
}
export async function dispatchNotifications(env:NotificationWorkerEnv){
 const requestId=crypto.randomUUID();
 let reminders:unknown;
 try{reminders=await rpc(env,"notifications_process_reminders",{batch_size:100});}catch{logger.warn("Reminder sweep unavailable",{requestId,code:"reminder_sweep_failed"});}
 // Run the existing application email processor through its internal service binding.
 try{
  const email=await env.APP.fetch(new Request("https://roomza.internal/api/cron/notifications/dispatch",{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:"Bearer "+env.CRON_SECRET}}));
  if(!email.ok)logger.warn("Notification email sweep unavailable",{requestId,status:email.status});
 }catch{logger.warn("Notification email sweep unavailable",{requestId,code:"email_sweep_failed"});}
 let total=0;
 let sent=0,failed=0,expired=0;
 // At most five concurrent HTTP sends, each bounded by timeout and the database lease.
 for(let batch=0;batch<10;batch++){
  const deliveries=await rpc<Delivery[]>(env,"notifications_claim_push",{batch_size:5});
  if(!deliveries.length)break; total+=deliveries.length;
  await Promise.all(deliveries.map(async delivery=>{
   let outcome="retry",errorCode:string|null=null;
   try{
    if(!isAllowedPushEndpoint(delivery.subscription.endpoint)){outcome="skipped";errorCode="invalid_endpoint";}
    else{
     const authorization=await rpc<{allowed:boolean;previews:boolean}>(env,"notifications_authorize_push",{target:delivery.id,lease:delivery.leaseToken});
     if(!authorization.allowed){await rpc(env,"notifications_finish_push",{target:delivery.id,lease:delivery.leaseToken,outcome:"skipped",error_code:null});return;}
     const payload=await buildPushPayload({data:pushContent({...delivery,previews:authorization.previews}),options:{ttl:60,urgency:"normal"}},
      {...delivery.subscription,expirationTime:null},{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
     const response=await fetch(delivery.subscription.endpoint,{...payload,signal:AbortSignal.timeout(10000),redirect:"error"});
     await response.body?.cancel();
     if(response.ok){outcome="sent";sent++;}
     else if(response.status===404||response.status===410){outcome="gone";expired++;}
     else{errorCode="push_http_"+response.status;failed++;}
    }
   }catch{errorCode="push_transport_failed";failed++;}
   await rpc(env,"notifications_finish_push",{target:delivery.id,lease:delivery.leaseToken,outcome,error_code:errorCode});
  }));
 }
 const metrics=await rpc(env,"notifications_metrics");
 logger.info("Notification sweep completed",{requestId,reminders,total,sent,failed,expired,metrics});
 return {sent,failed,expired};
}
export default {
 async scheduled(_controller,env,ctx){
  ctx.waitUntil(dispatchNotifications(env).catch(()=>{
   logger.error("Notification sweep failed",{requestId:crypto.randomUUID(),code:"dispatch_failed"});
   throw new Error("Notification dispatch failed");
  }));
 },
 async fetch(){return new Response("Not found",{status:404});},
} satisfies ExportedHandler<NotificationWorkerEnv>;

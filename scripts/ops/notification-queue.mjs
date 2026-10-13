// Operator-only queue controls. Credentials come from a protected environment file.
import { createClient } from "@supabase/supabase-js";
const args=process.argv.slice(2),command=args[0]??"status";
const url=process.env.NOTIFICATION_SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Load the Supabase URL and service-role key from a protected environment file.");
const host=new URL(url).hostname,local=["localhost","127.0.0.1","::1"].includes(host);
if(command!=="status"&&!local&&!args.includes("--remote"))throw new Error("Use --remote explicitly for a hosted write.");
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const flags={inbox:"notifications_inbox",events:"notifications_event_generation",reminders:"notifications_reminders",push:"notifications_push"};
let result;
if(command==="status"){
 const [metrics,settings]=await Promise.all([client.rpc("notifications_metrics"),client.from("app_feature_flags").select("key,enabled,updated_at").in("key",Object.values(flags))]);
 if(metrics.error||settings.error)throw new Error("Queue status could not be read.");
 result={target:new URL(url).origin,metrics:metrics.data,flags:settings.data};
}else if(command==="retry"){
 const id=args[1];if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id??""))throw new Error("Provide a delivery UUID.");
 const response=await client.rpc("notifications_retry_push",{target:id});if(response.error)throw new Error("Retry failed.");result={retryScheduled:response.data};
}else if(command==="enable"||command==="disable"){
 const flag=flags[args[1]];if(!flag)throw new Error("Choose inbox, events, reminders, or push.");
 const response=await client.from("app_feature_flags").update({enabled:command==="enable",updated_at:new Date().toISOString()}).eq("key",flag);
 if(response.error)throw new Error("Flag update failed.");result={flag,enabled:command==="enable"};
}else throw new Error("Use status, retry <delivery UUID>, or enable/disable <inbox|events|reminders|push>.");
console.log(JSON.stringify(result,null,2));

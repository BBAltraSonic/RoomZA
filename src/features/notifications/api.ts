import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationForDisplay, type NotificationInboxRow } from "./inbox-contract";
import { defaultNotificationOptions, notificationMutationSchema, notificationOptionsSchema, notificationQuerySchema, pushRegistrationSchema } from "./contract";
import { z } from "zod";
const headers = { "Cache-Control":"private, no-store", Vary:"Cookie" };
const json = (body:unknown,status=200)=>Response.json(body,{status,headers});
async function identity() {
 const client = await createClient() as unknown as SupabaseClient;
 const {data:{user},error}=await client.auth.getUser();
 if(error || !user || user.is_anonymous) return null;
 const access=await client.rpc("notification_access");
 if(access.error || access.data!==true) return null;
 return {client,user};
}
export async function handleNotificationApi(request:Request,section:"inbox"|"settings"|"devices"="inbox") {
 try {
  if(request.method!=="GET" && request.headers.get("origin")!==new URL(request.url).origin) return json({error:"Same-origin request required."},403);
  const auth=await identity(); if(!auth) return json({error:"Sign in with an active account to view notifications."},401);
  const {client,user}=auth;
  if(section==="inbox") {
   if(request.method==="GET") {
    const query=notificationQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const {data:flags,error:flagError}=await client.rpc("notification_client_flags");
    if(flagError) throw flagError;
    if(!flags.inbox) return json({userId:user.id,enabled:false,items:[],unreadCount:0,next:null,serverNow:new Date().toISOString()});
    let list=client.from("notification_events").select("id,type,category,payload,read_at,created_at").eq("recipient_id",user.id)
     .eq("in_app_visible",true).is("archived_at",null).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(query.limit+1);
    if(query.before) list=list.or("created_at.lt."+query.before+",and(created_at.eq."+query.before+",id.lt."+query.beforeId+")");
    if(query.unread==="true") list=list.is("read_at",null);
    if(query.category) list=list.eq("category",query.category);
    const [result,count,options]=await Promise.all([list,client.from("notification_events").select("id",{count:"exact",head:true})
     .eq("recipient_id",user.id).eq("in_app_visible",true).is("archived_at",null).is("read_at",null),client.from("notification_options").select("timezone").eq("user_id",user.id).maybeSingle()]);
    if(result.error || count.error || options.error) throw result.error || count.error || options.error;
    const page=(result.data??[]).slice(0,query.limit) as NotificationInboxRow[];
    const last=page.at(-1);
    let items: import('./inbox-contract').NotificationItem[]=page.map(notificationForDisplay);
    const contacts=items.flatMap(item=>item.contactRequestId?[item.contactRequestId]:[]);
    if(contacts.length){const states=await client.rpc("notification_contact_states",{request_ids:contacts});if(states.error)throw states.error;
     const handled=new Map((states.data as {id:string;handled:boolean}[]).map(state=>[state.id,state.handled]));
     items=items.map(item=>({...item,contactHandled:item.contactRequestId?handled.get(item.contactRequestId)??false:undefined}));}

    return json({userId:user.id,enabled:true,timezone:options.data?.timezone??"Africa/Johannesburg",items,unreadCount:count.count??0,
     next:(result.data??[]).length>query.limit && last ? {before:last.created_at,beforeId:last.id}:null,serverNow:new Date().toISOString()});
   }
   if(request.method!=="PATCH") return json({error:"Unsupported method."},405);
   const body=notificationMutationSchema.parse(await request.json());
   const result=await client.rpc("notification_update_state",{action:body.action,target:"id" in body?body.id:null,through:"through" in body?body.through:null});
   if(result.error) throw result.error;
   return json({changed:result.data});
  }
  if(section==="devices") {
   if(request.method==="GET") {
    const result=await client.rpc("notification_device_manage",{command:"list"}); if(result.error) throw result.error;
    return json({devices:result.data});
   }
   if(request.method==="DELETE") {
    const body=z.object({id:z.string().uuid()}).strict().parse(await request.json());
    const result=await client.rpc("notification_device_manage",{command:"remove",device:body.id}); if(result.error) throw result.error;
    return json(result.data);
   }
   if(request.method!=="POST") return json({error:"Unsupported method."},405);
   const body=pushRegistrationSchema.parse(await request.json());
   const result=await client.rpc("notification_device_manage",{command:"register",subscription:body}); if(result.error) throw result.error;
   return json(result.data);
  }
  if(request.method==="GET") {
   const [options,devices,flags,subscriptions]=await Promise.all([
    client.from("notification_options").select("previews,quiet_enabled,quiet_start,quiet_end,timezone").eq("user_id",user.id).maybeSingle(),
    client.rpc("notification_device_manage",{command:"list"}),client.rpc("notification_client_flags"),
    client.from("notification_subscriptions").select("category,channel,enabled,frequency").eq("user_id",user.id),
   ]);
   if(options.error || devices.error || flags.error || subscriptions.error) throw new Error("Settings unavailable");
   const p=options.data;
   return json({options:p?{previews:p.previews,quietEnabled:p.quiet_enabled,quietStart:p.quiet_start.slice(0,5),quietEnd:p.quiet_end.slice(0,5),timezone:p.timezone}:defaultNotificationOptions,
    devices:devices.data,flags:flags.data,subscriptions:subscriptions.data,
    publicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY??null});
  }
  if(request.method!=="PATCH") return json({error:"Unsupported method."},405);
  const options=notificationOptionsSchema.parse(await request.json());
  const result=await client.from("notification_options").upsert({user_id:user.id,previews:options.previews,quiet_enabled:options.quietEnabled,
   quiet_start:options.quietStart,quiet_end:options.quietEnd,timezone:options.timezone},{onConflict:"user_id"});
  if(result.error) throw result.error;
  return json({saved:true});
 } catch(error) {
  return json({error:error instanceof z.ZodError?"Invalid notification request.":"Notifications could not be updated. Please retry."},error instanceof z.ZodError?422:503);
 }
}

export async function handleNotificationContact(request:Request) {
 try {
  if(request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Same-origin request required."},403);
  const auth=await identity();if(!auth)return json({error:"Sign in with an active account."},401);
  const body=z.object({id:z.string().uuid()}).strict().parse(await request.json());
  const result=await auth.client.rpc("notification_handle_contact",{target:body.id});if(result.error)throw result.error;
  return json({handled:result.data});
 }catch(error){return json({error:error instanceof z.ZodError?"Invalid request.":"Contact request could not be updated."},error instanceof z.ZodError?422:503);}
}

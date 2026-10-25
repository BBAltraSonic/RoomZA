"use client";
import { useEffect,useState,useSyncExternalStore } from "react";
import { defaultNotificationOptions,notificationCategories,notificationCategoryLabels } from "./contract";
import { notificationRequest } from "./notification-provider";
import { updateNormalizedNotificationPreferenceAction } from "@/features/profile/actions";
import { Button } from "@/components/ui/button";
type Device={id:string;label:string;createdAt:string};
type Subscription={category:string;channel:string;enabled:boolean;frequency:string};
type Settings={options:typeof defaultNotificationOptions;devices:Device[];flags:{push:boolean};publicKey:string|null;subscriptions:Subscription[]};
function deviceLabel(){
 const agent=navigator.userAgent;
 const browser=/Edg\//.test(agent)?"Edge":/Firefox\//.test(agent)?"Firefox":/Chrome\//.test(agent)?"Chrome":/Safari\//.test(agent)?"Safari":"Browser";
 const platform=/iPhone/.test(agent)?"iPhone":/iPad/.test(agent)?"iPad":/Android/.test(agent)?"Android":/Windows/.test(agent)?"Windows":/Mac/.test(agent)?"Mac":"this device";
 return browser+" on "+platform;
}
function vapidBytes(value:string){
 const decoded=atob(value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
const subscribeSupport=()=>()=>{};
const deviceNotificationsSupported=()=>typeof window!=="undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
const serverSupport=()=>false;
export function PushControls(){
 const [settings,setSettings]=useState<Settings|null>(null),[options,setOptions]=useState(defaultNotificationOptions),
 [error,setError]=useState<string|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const supported=useSyncExternalStore(subscribeSupport,deviceNotificationsSupported,serverSupport);
 async function load(){const value=await notificationRequest("/api/notifications/settings");setSettings(value);setOptions(value.options);}
 useEffect(()=>{let cancelled=false;void notificationRequest("/api/notifications/settings").then(value=>{if(!cancelled){setSettings(value);setOptions(value.options);}}).catch(err=>{if(!cancelled)setError(err.message);});return()=>{cancelled=true;};},[]);
 async function perform(work:()=>Promise<void>){setBusy(true);setError(null);setNotice("");try{await work();}catch(err){setError(err instanceof Error?err.message:"Notification settings could not be updated.");}finally{setBusy(false);}}
 async function enable(){
  if(!settings?.publicKey) throw new Error("Device notifications are not available yet.");
  // Permission stays directly attached to the user's button press.
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){setNotice("Device permission was not granted. Your in-app inbox remains available.");return;}
  await navigator.serviceWorker.register("/notifications-sw.js",{scope:"/"});
  const ready=await navigator.serviceWorker.ready;
  const previous=await ready.pushManager.getSubscription();
  const sub=previous??await ready.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(settings.publicKey)});
  try{
   await notificationRequest("/api/notifications/devices","POST",{...sub.toJSON(),endpoint:sub.endpoint,label:deviceLabel(),expirationTime:undefined});
   const {createClient}=await import("@/lib/supabase/browser");const {data:{user}}=await createClient().auth.getUser();
   ready.active?.postMessage({type:"notification-user",userId:user?.id??null});
  }catch(err){if(!previous)await sub.unsubscribe();throw err;}
  await load();setNotice("Device notifications enabled.");
 }
 async function remove(id:string){
  await notificationRequest("/api/notifications/devices","DELETE",{id});
  // Revoke this exact database device; other device registrations stay intact.
  await load();setNotice("Device removed.");
 }
 async function save(){await notificationRequest("/api/notifications/settings","PATCH",options);setNotice("Notification settings saved.");}
 async function preference(category:string,enabled:boolean){
  const result=await updateNormalizedNotificationPreferenceAction({category,channel:"push",enabled,frequency:enabled?"instant":"never"});
  if(!result.success)throw new Error(result.error);await load();
 }
 return <section className="space-y-5 border-y border-border py-6">
  <div><h3 className="text-lg font-semibold">Device notifications</h3><p className="mt-2 text-sm text-muted-foreground">Receive updates when the app is closed. Enable each device you use.</p></div>
  {error?<p role="alert" className="text-sm text-status-error-text">{error}</p>:null}{notice?<p role="status" className="text-sm text-status-success-text">{notice}</p>:null}
  {error&&!settings?<Button variant="outline" disabled={busy} onClick={()=>void perform(load)}>Retry notification settings</Button>:null}
  {!supported?<p className="text-sm text-muted-foreground">This browser does not currently support device notifications. On iPhone or iPad, add Pinpoint to your Home Screen and open it there.</p>:null}
  <Button disabled={busy||!supported||!settings?.flags.push||!settings?.publicKey} onClick={()=>void perform(enable)}>Enable on this device</Button>
  {settings&&!settings.flags.push?<p className="text-sm text-muted-foreground">Device notifications are being prepared. Your in-app notifications are available now.</p>:null}
  <ul className="divide-y divide-border">{settings?.devices.map(device=><li key={device.id} className="flex items-center justify-between gap-4 py-3"><span className="text-sm">{device.label}</span><Button variant="ghost" disabled={busy} onClick={()=>void perform(()=>remove(device.id))}>Remove device</Button></li>)}</ul>
  <fieldset className="space-y-3"><legend className="mb-3 font-semibold text-sm">Push categories</legend>
   {notificationCategories.map(category=><label key={category} className="flex min-h-11 items-center justify-between gap-4 text-sm capitalize">{notificationCategoryLabels[category]}
    <input type="checkbox" className="size-5 accent-[var(--forest)]" disabled={busy||!settings}
     checked={settings?.subscriptions.find(s=>s.category===category&&s.channel==="push")?.enabled??true}
     onChange={event=>void perform(()=>preference(category,event.target.checked))}/></label>)}
  </fieldset>
  <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Show message previews
   <input type="checkbox" className="size-5 accent-[var(--forest)]" disabled={busy||!settings} checked={options.previews} onChange={event=>setOptions({...options,previews:event.target.checked})}/></label>
  <label className="flex min-h-11 items-center justify-between gap-4 text-sm">Quiet hours for device notifications
   <input type="checkbox" className="size-5 accent-[var(--forest)]" disabled={busy||!settings} checked={options.quietEnabled} onChange={event=>setOptions({...options,quietEnabled:event.target.checked})}/></label>
  {options.quietEnabled?<div className="flex flex-wrap gap-4">
   <label className="grid gap-2 text-sm">From<input type="time" disabled={busy||!settings} value={options.quietStart} onChange={event=>setOptions({...options,quietStart:event.target.value})} className="h-11 rounded-lg border border-input bg-background px-3"/></label>
   <label className="grid gap-2 text-sm">Until<input type="time" disabled={busy||!settings} value={options.quietEnd} onChange={event=>setOptions({...options,quietEnd:event.target.value})} className="h-11 rounded-lg border border-input bg-background px-3"/></label>
  </div>:null}
  <label className="grid max-w-sm gap-2 text-sm">Timezone<input disabled={busy||!settings} value={options.timezone} onChange={event=>setOptions({...options,timezone:event.target.value})} className="h-11 rounded-lg border border-input bg-background px-3"/></label>
  <Button variant="outline" disabled={busy||!settings} onClick={()=>void perform(save)}>Save device settings</Button>
 </section>;
}

"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import type { NotificationItem } from "./inbox-contract";
import { NAVIGATION_IDENTITY_EVENT } from "@/features/auth/navigation-account-events";
type Snapshot={userId:string|null;items:NotificationItem[];unreadCount:number;serverNow:string;timezone?:string;enabled:boolean};
type Context=Snapshot & {error:string|null;refresh:()=>Promise<void>;change:(body:unknown)=>Promise<boolean>};
const empty:Snapshot={userId:null,items:[],unreadCount:0,serverNow:"",enabled:false};
export const NotificationContext=createContext<Context|null>(null);
export const useNotifications=()=>useContext(NotificationContext);
export async function notificationRequest(path:string,method="GET",body?:unknown) {
 const response=await fetch(path,{method,cache:"no-store",signal:AbortSignal.timeout(10000),headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
 const value=await response.json();
 if(!response.ok) throw new Error(value.error??"Notifications are unavailable.");
 return value;
}
export function NotificationProvider({enabled,children}:{enabled:boolean;children:React.ReactNode}) {
 const [snapshot,setSnapshot]=useState(empty),[error,setError]=useState<string|null>(null);
 const pathname=usePathname(),path=useRef(pathname);
 useEffect(()=>{path.current=pathname;},[pathname]);
 const identity=useRef<string|null>(null),epoch=useRef(0),channel=useRef<BroadcastChannel|null>(null);
 const refreshRef=useRef<(newId?:string)=>Promise<void>>(async()=>{});
 const refresh=useCallback(async()=>refreshRef.current(),[]);
 useEffect(()=>{
  if(!enabled) return;
  let disposed=false; let subscription:{unsubscribe:()=>void}|undefined; let cleanupRealtime:()=>void=()=>{};
  let pending:Promise<void>|undefined;let bindIdentity:(id:string|null)=>void=reset;
  let retryIdentity:(()=>Promise<void>)|undefined;
  let identityRead:Promise<void>|undefined;
  ++epoch.current;
  async function refreshNow(newId?:string) {
   if(disposed) return;
   if(pending){await pending; if(!disposed && (newId || identity.current!==null)) return refreshNow(newId); return;}
   const current=epoch.current, userId=identity.current;
   pending=(async()=>{
    try {
     const value=await notificationRequest("/api/notifications");
     if(disposed || current!==epoch.current || userId!==identity.current || value.userId!==userId) return;
     setSnapshot(value);setError(null);
     const item:NotificationItem|undefined=newId?value.items.find((i:NotificationItem)=>i.id===newId):undefined;
     if(item?.unread && document.visibilityState==="visible" && !(item.href?.startsWith("/messages/") && item.href===path.current)) {
      toast(item.title,{description:item.message,action:item.href?{label:"Open",onClick:()=>window.location.assign(item.href!)}:undefined,id:item.id});
     }
    } catch(err) {
     if(!disposed && current===epoch.current) setError(err instanceof Error?err.message:"Notifications are unavailable.");
    }
   })();
   try {await pending;} finally {pending=undefined;}
  }
  refreshRef.current=async()=>{
   if(identity.current===null && retryIdentity){await retryIdentity();return;}
   await refreshNow();
  };
  function bindWorker(userId:string|null) {
   const current=epoch.current;
   if("serviceWorker" in navigator) void navigator.serviceWorker.getRegistration("/").then(reg=>{if(current===epoch.current)reg?.active?.postMessage({type:"notification-user",userId});});
  }
  function reset(userId:string|null) {
   epoch.current++; identity.current=userId; setSnapshot(empty);setError(null);cleanupRealtime();bindWorker(userId);
   if(userId) void refreshNow();
  }
  void import("@/lib/supabase/browser").then(({createClient})=>{
   if(disposed) return;
   const client=createClient();
   function bind(userId:string|null){
    reset(userId);
    if(!userId) return;
    const realtime=client.channel("notifications:"+userId).on("postgres_changes",{event:"*",schema:"public",table:"notification_events",filter:"recipient_id=eq."+userId},
     payload=>{void refreshNow(payload.eventType==="INSERT"?String(payload.new.id):undefined);})
     .subscribe(status=>{if(status==="SUBSCRIBED") void refreshNow();});
    cleanupRealtime=()=>{void client.removeChannel(realtime);};
   }
   bindIdentity=bind;
   const auth=client.auth.onAuthStateChange((event,session)=>{
    if(event==="SIGNED_OUT" || (session?.user.id && session.user.id!==identity.current)) bind(event==="SIGNED_OUT"?null:session!.user.id);
   });
   subscription=auth.data.subscription;
   async function readIdentity(){
    if(identityRead){await identityRead;return;}
    const current=epoch.current;
    const work=(async()=>{try {
     const {data:{user},error}=await client.auth.getUser();
     if(disposed || current!==epoch.current) return;
     if(error) throw error;
     bind(user?.id??null);
    }catch{
     if(!disposed && current===epoch.current) setError("Notifications could not reconnect. Try again.");
    }})();
    identityRead=work;
    try{await work;}finally{if(identityRead===work)identityRead=undefined;}
   }
   retryIdentity=async()=>{await readIdentity();await pending;};
   void readIdentity();
  }).catch(()=>{if(!disposed)setError("Notifications are unavailable.");});
  function clearIdentity(){epoch.current++;identity.current=null;}
  function identityChanged(event:Event) {
   const next=(event as CustomEvent<{userId:string|null}>).detail.userId;
   if(next!==identity.current) bindIdentity(next);
  }
  function visible(){if(document.visibilityState==="visible") void refreshNow();}
  window.addEventListener(NAVIGATION_IDENTITY_EVENT,identityChanged);
  document.addEventListener("visibilitychange",visible);
  window.addEventListener("online",visible);
  const timer=window.setInterval(visible,30000);
  const broadcasts=typeof BroadcastChannel==="undefined"?null:new BroadcastChannel("pinpoint-notifications");
  channel.current=broadcasts;
  if(broadcasts) broadcasts.onmessage=()=>{void refreshNow();};
  return ()=>{
   disposed=true;clearIdentity();bindWorker(null);refreshRef.current=async()=>{};
   subscription?.unsubscribe();cleanupRealtime();clearInterval(timer);broadcasts?.close();channel.current=null;
   window.removeEventListener(NAVIGATION_IDENTITY_EVENT,identityChanged);document.removeEventListener("visibilitychange",visible);window.removeEventListener("online",visible);
  };
 },[enabled]);
 const change=useCallback(async(body:unknown)=>{
  const current=epoch.current;
  try {
   await notificationRequest("/api/notifications","PATCH",body);
   if(current!==epoch.current) return false;
   channel.current?.postMessage("refresh");await refresh();return true;
  }catch(err){setError(err instanceof Error?err.message:"Update failed.");return false;}
 },[refresh]);
 return <NotificationContext.Provider value={{...(enabled?snapshot:empty),error:enabled?error:null,refresh,change}}>{children}</NotificationContext.Provider>;
}

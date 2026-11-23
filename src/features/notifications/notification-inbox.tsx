"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, BadgeCheck, Bell, BellOff, Building2, CalendarDays, Check, CheckCheck, ChevronDown, FileText, MessageCircle, Search, ShieldCheck, Star, Tag, type LucideIcon } from "lucide-react";
import { useNotifications, notificationRequest } from "./notification-provider";
import { notificationCategories,notificationCategoryLabels } from "./contract";
import type { NotificationItem } from "./inbox-contract";
import styles from "./notifications.module.css";
type Page={enabled?:boolean;userId:string;items:NotificationItem[];next:{before:string;beforeId:string}|null;serverNow:string};
const categoryIcons:Record<string,LucideIcon>={messages:MessageCircle,applications:FileText,viewings:CalendarDays,offers:Tag,saved_searches:Search,security:ShieldCheck,account_updates:Building2,reviews:Star,verification:BadgeCheck};
const relative=new Intl.RelativeTimeFormat("en-ZA",{numeric:"auto",style:"short"});
/** Short "5 min ago" label for the last week; older items fall back to the absolute date. */
function relativeTime(createdAt:string,now:number){
 const seconds=Math.round((new Date(createdAt).getTime()-now)/1000);
 if(seconds>-45)return "Just now";
 for(const [unit,size] of [["minute",60],["hour",3600],["day",86400]] as const){
  const next=unit==="minute"?3600:unit==="hour"?86400:604800;
  if(-seconds<next)return relative.format(Math.round(seconds/size),unit);
 }
 return null;
}
export function NotificationInbox({compact=false,onNavigate}:{compact?:boolean;onNavigate?:()=>void}) {
 const live=useNotifications(),[page,setPage]=useState<Page|null>(null),[unread,setUnread]=useState(false),[category,setCategory]=useState(""),
 [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!compact),[retry,setRetry]=useState(0),
 [now,setNow]=useState<number|null>(null);
 const generation=useRef(0);
 // Relative times need the client clock, so the first (server) render shows absolute dates only.
 useEffect(()=>{queueMicrotask(()=>setNow(Date.now()));const timer=setInterval(()=>setNow(Date.now()),60000);return ()=>clearInterval(timer);},[]);
 useEffect(()=>{
  const current=++generation.current;const controller=new AbortController();
  if(compact && !unread && !category)return;
  queueMicrotask(()=>{if(!controller.signal.aborted)setLoading(true);});
  const query=new URLSearchParams({...unread?{unread:"true"}:{},...category?{category}:{}});
  void fetch("/api/notifications?"+query,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}).then(async response=>{
   const value=await response.json(); if(!response.ok) throw new Error(value.error);
   if(current===generation.current){setPage(value);setError(null);}
  }).catch(err=>{if(!controller.signal.aborted && current===generation.current)setError(err.message);})
   .finally(()=>{if(current===generation.current)setLoading(false);});
  return ()=>controller.abort();
 },[compact,unread,category,live?.items,live?.userId,retry]);
 const currentPage=compact&&!unread&&!category?null:page?.userId===live?.userId?page:null;
 const items=currentPage?.items??live?.items??[];
 const issue=error??live?.error;
 const timezone=live?.timezone??"Africa/Johannesburg";
 const zoneLabel=timezone==="Africa/Johannesburg"?"SAST":timezone.replaceAll("_"," ");
 const absolute=new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:timezone});
 async function update(body:unknown) {
  setBusy(true);const ok=await live?.change(body);if(ok)setRetry(n=>n+1);setBusy(false);
 }
 async function older() {
  if(!currentPage?.next) return;setBusy(true);const current=generation.current;
  try{
   const query=new URLSearchParams({...currentPage.next,...unread?{unread:"true"}:{},...category?{category}:{}});
   const next=await notificationRequest("/api/notifications?"+query);
   if(current===generation.current)setPage(previous=>previous?{...next,items:[...previous.items,...next.items]}:next);
  }catch(err){setError(err instanceof Error?err.message:"Could not load older notifications.");}
  finally{setBusy(false);}
 }
 async function handled(id:string) {
  setBusy(true);
  try{await notificationRequest("/api/notifications/contact","PATCH",{id});await live?.refresh();}
  catch(err){setError(err instanceof Error?err.message:"Could not update contact request.");}
  finally{setBusy(false);}
 }
 const unreadCount=live?.unreadCount??0;
 return <div className={styles.inbox} data-compact={compact}>
  <div className={styles.toolbar}>
   <div role="group" aria-label="Notification filter" className={styles.tabs}>
    <button type="button" aria-pressed={!unread} onClick={()=>setUnread(false)}>All</button>
    <button type="button" aria-pressed={unread} onClick={()=>setUnread(true)}>Unread{unreadCount>0?<span className={styles.tabCount}>{unreadCount>99?"99+":unreadCount}</span>:null}</button>
   </div>
   <label className={styles.category}><span className={styles.srOnly}>Category</span>
    <select value={category} onChange={event=>setCategory(event.target.value)}>
     <option value="">All categories</option>{notificationCategories.map(value=><option key={value} value={value}>{notificationCategoryLabels[value]}</option>)}
    </select>
    <ChevronDown size={14} aria-hidden="true"/>
   </label>
   <button type="button" disabled={busy||!unreadCount} onClick={()=>void update({action:"read_all",through:currentPage?.serverNow||live?.serverNow})}
    className={styles.iconButton} aria-label="Mark all read" title="Mark all read"><CheckCheck size={18} aria-hidden="true"/></button>
  </div>
  {issue?<div role="alert" className={styles.notice}><span>{issue}</span><button type="button" onClick={()=>{setRetry(n=>n+1);void live?.refresh();}}>Try again</button></div>:null}
  {currentPage?.enabled===false?<p role="status" className={styles.empty}>Notifications are temporarily unavailable.</p>
  :loading&&!(compact&&!unread&&!category)?<ol className={styles.list} aria-hidden="true">{[0,1,2].map(n=><li key={n} className={styles.skeleton}><span/><div><span/><span/></div></li>)}<p role="status" className={styles.srOnly}>Loading notifications…</p></ol>
  :items.length?<ol className={styles.list} aria-label="Your notifications">
   {items.map(item=>{
    const Icon=(item.category&&categoryIcons[item.category])||Bell;
    const exact=absolute.format(new Date(item.createdAt))+" "+zoneLabel;
    const ago=now===null?null:relativeTime(item.createdAt,now);
    return <li key={item.id} className={styles.item} data-unread={item.unread}>
     <span className={styles.itemIcon} aria-hidden="true"><Icon size={17}/></span>
     <div className={styles.itemBody}>
      <div className={styles.itemHeading}>
       <h3>{item.href?<Link prefetch={false} href={item.href} className={styles.itemLink} onClick={()=>{if(item.unread)void live?.change({action:"read",id:item.id});onNavigate?.();}}>{item.title}</Link>:item.title}</h3>
       <time dateTime={item.createdAt} title={exact}>{ago??exact}</time>
      </div>
      <p>{item.message}</p>
      {item.contactHandled?<span className={styles.chip}><Check size={13} aria-hidden="true"/>Request handled</span>
      :item.contactRequestId?<button type="button" className={styles.chipButton} disabled={busy} onClick={()=>void handled(item.contactRequestId!)}>Mark request handled</button>:null}
     </div>
     {item.unread?<span className={styles.unreadDot} role="img" aria-label="Unread"/>:null}
     <div className={styles.itemActions}>
      {item.unread?<button type="button" disabled={busy} aria-label={"Mark read: "+item.title} title="Mark read" onClick={()=>void update({action:"read",id:item.id})}><Check size={15} aria-hidden="true"/></button>:null}
      <button type="button" disabled={busy} aria-label={"Archive: "+item.title} title="Archive" onClick={()=>void update({action:"archive",id:item.id})}><Archive size={15} aria-hidden="true"/></button>
     </div>
    </li>;
   })}
  </ol>:!issue?<div className={styles.empty}><span className={styles.emptyIcon} aria-hidden="true"><BellOff size={22}/></span><p>{unread?"You’re all caught up":"No notifications yet"}</p><span>Messages, important updates, and reminders appear here.</span></div>:null}
  {!compact && currentPage?.next?<button type="button" className={styles.loadMore} disabled={busy} onClick={()=>void older()}>Load older notifications</button>:null}
 </div>;
}

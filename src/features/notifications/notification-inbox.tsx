"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, Check, CheckCheck } from "lucide-react";
import { useNotifications, notificationRequest } from "./notification-provider";
import { notificationCategories,notificationCategoryLabels } from "./contract";
import type { NotificationItem } from "./inbox-contract";
import styles from "./notifications.module.css";
type Page={enabled?:boolean;userId:string;items:NotificationItem[];next:{before:string;beforeId:string}|null;serverNow:string};
export function NotificationInbox({compact=false,onNavigate}:{compact?:boolean;onNavigate?:()=>void}) {
 const live=useNotifications(),[page,setPage]=useState<Page|null>(null),[unread,setUnread]=useState(false),[category,setCategory]=useState(""),
 [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!compact),[retry,setRetry]=useState(0);
 const generation=useRef(0);
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
 return <div className={styles.inbox}>
  <div className={styles.toolbar}>
   <div role="group" aria-label="Notification filter" className={styles.tabs}>
    <button type="button" aria-pressed={!unread} onClick={()=>setUnread(false)}>All</button>
    <button type="button" aria-pressed={unread} onClick={()=>setUnread(true)}>Unread</button>
   </div>
   <button type="button" disabled={busy||!live?.unreadCount} onClick={()=>void update({action:"read_all",through:currentPage?.serverNow||live?.serverNow})}
    className={styles.textButton}><CheckCheck size={16} aria-hidden="true"/>Mark all read</button>
  </div>
  <label className={styles.category}>Category
   <select value={category} onChange={event=>setCategory(event.target.value)}>
    <option value="">All categories</option>{notificationCategories.map(value=><option key={value} value={value}>{notificationCategoryLabels[value]}</option>)}
   </select>
  </label>
  {issue?<div role="alert" className={styles.notice}>{issue}<button type="button" onClick={()=>{setRetry(n=>n+1);void live?.refresh();}}>Try again</button></div>:null}
  {currentPage?.enabled===false?<p role="status" className={styles.empty}>Notifications are temporarily unavailable.</p>:loading&&!(compact&&!unread&&!category)?<p role="status" className={styles.empty}>Loading notifications…</p>:items.length?<ol className={styles.list} aria-label="Your notifications">
   {items.map(item=><li key={item.id} className={styles.item} data-unread={item.unread}>
    <div className={styles.itemHeading}><h3>{item.title}</h3>{item.unread?<span className={styles.unreadDot} aria-label="Unread"/>:null}</div>
    <p>{item.message}</p>
    <time dateTime={item.createdAt}>{new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:live?.timezone??"Africa/Johannesburg"}).format(new Date(item.createdAt))} {(!live?.timezone||live.timezone==="Africa/Johannesburg")?"SAST":live.timezone.replaceAll("_"," ")}</time>
    <div className={styles.itemActions}>
     {item.href?<Link prefetch={false} href={item.href} onClick={()=>{if(item.unread)void live?.change({action:"read",id:item.id});onNavigate?.();}}>Open</Link>:null}
     {item.contactHandled?<span className={styles.textButton}>Request handled</span>:item.contactRequestId?<button type="button" disabled={busy} onClick={()=>void handled(item.contactRequestId!)}>Mark request handled</button>:null}
     {item.unread?<button type="button" disabled={busy} onClick={()=>void update({action:"read",id:item.id})}><Check size={15} aria-hidden="true"/>Mark read</button>:null}
     <button type="button" disabled={busy} onClick={()=>void update({action:"archive",id:item.id})}><Archive size={15} aria-hidden="true"/>Archive</button>
    </div>
   </li>)}
  </ol>:!issue?<div className={styles.empty}><p>{unread?"You’re all caught up":"No notifications yet"}</p><span>Messages, important updates, and reminders appear here.</span></div>:null}
  {!compact && currentPage?.next?<button type="button" className={styles.textButton} disabled={busy} onClick={()=>void older()}>Load older notifications</button>:null}
 </div>;
}

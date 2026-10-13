"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Bell, X } from "lucide-react";
import { Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose } from "@/components/ui/dialog";
import { useNotifications } from "./notification-provider";
const NotificationInbox=dynamic(()=>import("./notification-inbox").then(module=>module.NotificationInbox),{loading:()=> <p role="status">Loading notifications…</p>});
import styles from "./notifications.module.css";
export function NotificationBell({className}:{className?:string}) {
 const live=useNotifications(),[open,setOpen]=useState(false);
 if(!live || !live.enabled) return <Link prefetch={false} href="/profile/notifications" aria-label="Notifications" title="Notifications" className={className}><Bell size={17} aria-hidden="true"/></Link>;
 return <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger className={className} title="Notifications" aria-label={"Notifications"+(live.unreadCount?", "+live.unreadCount+" unread":"")}>
   <span className={styles.bell}><Bell size={17} aria-hidden="true"/>{live.unreadCount>0?<span className={styles.badge}>{live.unreadCount>99?"99+":live.unreadCount}</span>:null}</span>
  </DialogTrigger>
  <DialogContent className={styles.panel} showCloseButton={false}>
   <DialogClose className={styles.close} aria-label="Close notifications"><X size={20} aria-hidden="true"/></DialogClose>
   <DialogTitle className={styles.title}>Notifications</DialogTitle>
   <DialogDescription>Updates and reminders for your account.</DialogDescription>
   {open?<NotificationInbox compact onNavigate={()=>setOpen(false)}/>:null}
   <div className={styles.footer}><Link href="/profile/notifications" prefetch={false} onClick={()=>setOpen(false)}>View all notifications</Link>
    <Link href="/settings/notifications" prefetch={false} onClick={()=>setOpen(false)}>Settings</Link></div>
  </DialogContent>
 </Dialog>;
}

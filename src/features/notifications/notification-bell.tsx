"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Bell, Settings, X } from "lucide-react";
import { Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose } from "@/components/ui/dialog";
import { useNotifications } from "./notification-provider";
const NotificationInbox=dynamic(()=>import("./notification-inbox").then(module=>module.NotificationInbox),{loading:()=> <p role="status" className={styles.loading}>Loading notifications…</p>});
import styles from "./notifications.module.css";
export function NotificationBell({className}:{className?:string}) {
 const live=useNotifications(),[open,setOpen]=useState(false);
 if(!live || !live.enabled) return <Link prefetch={false} href="/profile/notifications" aria-label="Notifications" title="Notifications" className={className}><Bell size={17} aria-hidden="true"/></Link>;
 return <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger className={className} title="Notifications" aria-label={"Notifications"+(live.unreadCount?", "+live.unreadCount+" unread":"")}>
   <span className={styles.bell}><Bell size={17} aria-hidden="true"/>{live.unreadCount>0?<span className={styles.badge}>{live.unreadCount>99?"99+":live.unreadCount}</span>:null}</span>
  </DialogTrigger>
  <DialogContent className={styles.panel} showCloseButton={false}>
   <header className={styles.header}>
    <div>
     <DialogTitle className={styles.title}>Notifications</DialogTitle>
     <DialogDescription className={styles.description}>{live.unreadCount>0?live.unreadCount+" unread":"You’re all caught up"}</DialogDescription>
    </div>
    <DialogClose className={styles.iconButton} aria-label="Close notifications"><X size={18} aria-hidden="true"/></DialogClose>
   </header>
   {open?<NotificationInbox compact onNavigate={()=>setOpen(false)}/>:null}
   <footer className={styles.footer}>
    <Link href="/profile/notifications" prefetch={false} className={styles.viewAll} onClick={()=>setOpen(false)}>View all notifications</Link>
    <Link href="/settings/notifications" prefetch={false} className={styles.iconButton} aria-label="Notification settings" title="Notification settings" onClick={()=>setOpen(false)}><Settings size={18} aria-hidden="true"/></Link>
   </footer>
  </DialogContent>
 </Dialog>;
}

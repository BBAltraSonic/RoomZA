/* Notification-only service worker: never cache authenticated pages or responses. */
const bindingDatabase = () => new Promise((resolve,reject) => {
 const request=indexedDB.open("pinpoint-notification-identity",1);
 request.onupgradeneeded=()=>request.result.createObjectStore("identity");
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
async function boundUser(write,value) {
 const db=await bindingDatabase();
 try{return await new Promise((resolve,reject)=>{
  const transaction=db.transaction("identity",write?"readwrite":"readonly"),store=transaction.objectStore("identity");
  const request=write?store.put(value,"user"):store.get("user");
  transaction.oncomplete=()=>resolve(write?value:request.result);transaction.onerror=()=>reject(transaction.error);
 });}finally{db.close();}
}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
 if(event.data?.type!=="notification-user" || !event.source?.url || new URL(event.source.url).origin!==self.location.origin)return;
 event.waitUntil((async()=>{const userId=typeof event.data.userId==="string"?event.data.userId:null;await boundUser(true,userId);for(const notice of await self.registration.getNotifications()){if(notice.data?.accountId!==userId)notice.close();}})());
});
function safeDestination(value) {
 try {
  const url=new URL(value,self.location.origin);
  if(url.origin!==self.location.origin || !/^\/(messages\/|listing\/|offers(?:\?|$)|applications(?:\?|$)|profile(?:\/|$)|settings\/|post\/|dashboard\/)/.test(url.pathname+url.search))return "/profile/notifications";
  return url.pathname+url.search;
 }catch{return "/profile/notifications";}
}
self.addEventListener("push",event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json();}catch{return;}
 if(!data || typeof data.accountId!=="string" || await boundUser(false)!==data.accountId)return;
 await self.registration.showNotification(typeof data.title==="string"?data.title.slice(0,100):"Pinpoint update",{
  body:typeof data.body==="string"?data.body.slice(0,220):"You have a new update.",
  icon:"/icon.png",badge:"/icon.png",tag:"pinpoint:"+data.id,
  data:{href:safeDestination(data.href),accountId:data.accountId,id:data.id},
 });
})()));
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  if(await boundUser(false)!==event.notification.data?.accountId)return;
  const href=safeDestination(event.notification.data?.href);
  if(typeof event.notification.data?.id==="string") await fetch("/api/notifications",{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"read",id:event.notification.data.id})}).catch(()=>{});
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
  if(existing){await existing.navigate(href);await existing.focus();}else await self.clients.openWindow(href);
 })());
});

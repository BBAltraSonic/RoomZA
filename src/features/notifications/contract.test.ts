import {describe,it,expect} from "vitest";
import {isAllowedPushEndpoint,isInQuietHours,defaultNotificationOptions,notificationQuerySchema,notificationMutationSchema,notificationOptionsSchema} from "./contract";
describe("notification input boundaries",()=>{
 it("allows only genuine push service origins",()=>{
  for(const endpoint of ["https://fcm.googleapis.com/fcm/send/abc","https://updates.push.services.mozilla.com/wpush/v2/abc","https://web.push.apple.com/abc"])expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  for(const endpoint of ["https://fcm.googleapis.com.evil.invalid/abc","http://fcm.googleapis.com/abc","https://user@fcm.googleapis.com/abc","https://localhost/abc","https://127.0.0.1/abc","https://fcm.googleapis.com:123/abc","https://evil.invalid/abc"])expect(isAllowedPushEndpoint(endpoint)).toBe(false);
 });
 it("rejects partial and injected cursors, recipient overrides, and unbounded batches",()=>{
  expect(notificationQuerySchema.safeParse({category:"messages",unread:"true",limit:"30"}).success).toBe(true);
  for(const input of [{before:"2026-10-13T00:00:00Z"},{recipientId:"someone"},{limit:"1000"},{category:"raw"}])expect(notificationQuerySchema.safeParse(input).success).toBe(false);
 });
 it("rejects delivery and identity changes through inbox actions",()=>{
  expect(notificationMutationSchema.safeParse({action:"archive",id:"11111111-1111-4111-8111-111111111111"}).success).toBe(true);
  expect(notificationMutationSchema.safeParse({action:"read",id:"11111111-1111-4111-8111-111111111111",recipientId:"someone"}).success).toBe(false);
 });
 it("handles quiet hours across midnight in the selected timezone",()=>{
  const options={...defaultNotificationOptions,quietEnabled:true};
  expect(isInQuietHours(options,new Date("2026-10-13T20:00:00Z"))).toBe(true);
  expect(isInQuietHours(options,new Date("2026-10-13T03:00:00Z"))).toBe(true);
  expect(isInQuietHours(options,new Date("2026-10-13T08:00:00Z"))).toBe(false);
  expect(isInQuietHours({...options,quietEnabled:false},new Date("2026-10-13T20:00:00Z"))).toBe(false);
 });
 it("rejects invalid timezones and all-day ambiguous quiet hours",()=>{
  expect(notificationOptionsSchema.safeParse({...defaultNotificationOptions,timezone:"Invalid/Zone"}).success).toBe(false);
  expect(notificationOptionsSchema.safeParse({...defaultNotificationOptions,quietEnabled:true,quietStart:"08:00",quietEnd:"08:00"}).success).toBe(false);
 });
});

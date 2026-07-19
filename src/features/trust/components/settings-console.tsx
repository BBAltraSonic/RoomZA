"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Database, Download, ExternalLink, Fingerprint, Flag, KeyRound, LockKeyhole, MapPin, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/browser";

import { cancelPrivacyRequest, requestDataExport, signOutEverywhere, signOutOtherSessions, submitPrivacyRequest, updateNotificationPreferences } from "../settings-actions";
import type { NotificationPreferences } from "../settings-data";
import type { PrivacyRequest } from "../types";
import { UserMfaControls } from "./user-mfa-controls";

type Identity = { id: string; provider: string; email: string | null; lastSignInAt: string | null };
type Report = { id: string; category: string; status: string; targetKind: string; createdAt: string; updatedAt: string };

const settingsSections = [
  ["profile", UserRound, "Profile"],
  ["privacy", LockKeyhole, "Privacy & Data"],
  ["notifications", Bell, "Notifications"],
  ["security", ShieldCheck, "Security"],
  ["reports", Flag, "My reports"],
] as const;

function formatDate(value: string) { return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }

export function SettingsConsole({ email, identities, mfaFactors, sessions, initialPreferences, privacyRequests, reports }: { email: string; identities: Identity[]; mfaFactors: { id: string; friendlyName: string | null }[]; sessions: { id: string; createdAt: string | null; updatedAt: string | null; userAgent: string | null; isCurrent: boolean }[]; initialPreferences: NotificationPreferences; privacyRequests: PrivacyRequest[]; reports: Report[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [requestType, setRequestType] = useState<"correction" | "deletion" | "objection" | "withdraw_consent">("correction");
  const [details, setDetails] = useState("");

  function run(work: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => { const result = await work(); if (!result.success) { toast.error(result.error ?? "The action failed."); return; } toast.success(success); router.refresh(); });
  }

  function clearLocalDiscoveryData() {
    ["roomza:discovery-recent-searches", "roomza:recently-viewed-listings", "roomza:mobile-sheet-snap"].forEach((key) => { localStorage.removeItem(key); sessionStorage.removeItem(key); });
    toast.success("Local discovery history cleared");
  }

  async function linkGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings` } });
    if (error) toast.error(error.message);
  }

  async function unlinkIdentity(id: string) {
    const supabase = createClient();
    const { data, error: listError } = await supabase.auth.getUserIdentities();
    if (listError) return toast.error(listError.message);
    const identity = data.identities.find((item) => item.id === id);
    if (!identity) return toast.error("That sign-in method is no longer connected.");
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) return toast.error(error.message);
    toast.success("Sign-in method disconnected");
    router.refresh();
  }

  const preferenceToggle = (key: keyof NotificationPreferences, label: string, description: string, locked = false) => (
    <label className="flex min-h-16 items-center justify-between gap-5 border-b border-border py-3 last:border-b-0">
      <span><span className="block text-sm font-semibold text-ink">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
      <input type="checkbox" className="size-5 shrink-0 accent-[var(--forest)]" checked={Boolean(preferences[key])} disabled={locked || pending} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} />
    </label>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:self-start">
        {settingsSections.map(([id, SectionIcon, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"><SectionIcon className="size-4" />{label}</a>)}
      </nav>
      <div className="space-y-8">
        <section id="profile" className="scroll-mt-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]"><div className="flex items-start justify-between gap-4"><div><UserRound className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">Profile</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{email}</p></div><Button render={<Link href="/profile" />} variant="outline">Edit profile</Button></div></section>

        <section id="privacy" className="scroll-mt-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
          <LockKeyhole className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">Privacy &amp; Data</h2><p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">Download information held by Pinpoint, manage optional consent, or send a tracked POPIA request.</p>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {preferenceToggle("marketing", "Marketing consent", "Optional product and marketplace news. Off by default.")}
            {preferenceToggle("locationPersonalization", "Location personalization", "Allow saved location context to influence discovery suggestions.")}
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><Button disabled={pending} onClick={() => run(() => updateNotificationPreferences(preferences), "Privacy choices saved")}>Save choices</Button><Button variant="outline" onClick={clearLocalDiscoveryData}><MapPin className="size-4" />Clear local discovery history</Button></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border p-4"><Download className="size-5 text-forest" /><h3 className="mt-3 font-semibold text-ink">Download my data</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A private archive is prepared asynchronously and removed after seven days.</p><Button className="mt-4" variant="outline" disabled={pending} onClick={() => run(requestDataExport, "Export requested")}>Request export</Button></div><div className="rounded-xl border border-border p-4"><Database className="size-5 text-forest" /><h3 className="mt-3 font-semibold text-ink">Submit a privacy request</h3><select value={requestType} onChange={(event) => setRequestType(event.target.value as typeof requestType)} className="mt-3 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="correction">Correct my information</option><option value="deletion">Delete my account and eligible data</option><option value="objection">Object to processing</option><option value="withdraw_consent">Withdraw consent</option></select><Textarea className="mt-3" minLength={20} maxLength={5000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain what you need the privacy team to review." /><Button className="mt-3" disabled={pending || details.trim().length < 20} onClick={() => run(async () => { const result = await submitPrivacyRequest({ requestType, details }); if (result.success) setDetails(""); return result; }, "Privacy request submitted")}>Submit request</Button></div></div>
          <div className="mt-8"><h3 className="font-semibold text-ink">Request history</h3>{privacyRequests.length ? <div className="mt-3 divide-y divide-border border-y border-border">{privacyRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-ink">{request.requestType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(request.createdAt)} · target response {formatDate(request.dueAt)}</p></div><div className="flex items-center gap-2"><StatusBadge tone={request.status === "completed" ? "success" : request.status === "declined" || request.status === "cancelled" ? "neutral" : "info"}>{request.status.replaceAll("_", " ")}</StatusBadge>{request.requestType === "export" && request.status === "completed" && request.artifactExpiresAt && new Date(request.artifactExpiresAt) > new Date() ? <Button render={<a href={`/api/privacy/exports/${request.id}`} />} size="sm" variant="outline"><Download className="size-4" />Download</Button> : null}{["submitted", "waiting_on_user"].includes(request.status) ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelPrivacyRequest(request.id), "Request cancelled")}><Trash2 className="size-4" />Cancel</Button> : null}</div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No privacy requests yet.</p>}</div>
        </section>

        <section id="notifications" className="scroll-mt-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]"><Bell className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">Notifications</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Security, moderation, application, viewing and account notices cannot be disabled.</p><div className="mt-5 divide-y divide-border border-y border-border">{preferenceToggle("applicationUpdates", "Application updates", "Mandatory status changes and applicant activity.", true)}{preferenceToggle("viewingUpdates", "Viewing updates", "Mandatory proposals, bookings and changes.", true)}{preferenceToggle("messageDigest", "Message digest", "An optional summary of unread property conversations.")}{preferenceToggle("searchAlerts", "Search alerts", "Optional updates for searches you explicitly saved.")}</div><label className="mt-4 block text-xs font-semibold text-muted-foreground">Digest frequency<select value={preferences.digestFrequency} onChange={(event) => setPreferences((current) => ({ ...current, digestFrequency: event.target.value as NotificationPreferences["digestFrequency"] }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm sm:max-w-xs"><option value="never">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><Button className="mt-4" disabled={pending} onClick={() => run(() => updateNotificationPreferences(preferences), "Notification preferences saved")}>Save notifications</Button></section>

        <section id="security" className="scroll-mt-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]"><ShieldCheck className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">Security</h2><div className="mt-5 divide-y divide-border border-y border-border">{identities.map((identity) => <div key={identity.id} className="flex min-h-16 items-center justify-between gap-4 py-3"><div className="flex items-center gap-3"><Fingerprint className="size-5 text-muted-foreground" /><div><p className="text-sm font-semibold capitalize text-ink">{identity.provider}</p><p className="mt-1 text-xs text-muted-foreground">{identity.email ?? "Connected sign-in method"}</p></div></div>{identities.length > 1 ? <Button size="sm" variant="ghost" onClick={() => void unlinkIdentity(identity.id)}>Disconnect</Button> : <StatusBadge tone="success"><CheckCircle2 className="size-3" />Required</StatusBadge>}</div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void linkGoogle()}><ExternalLink className="size-4" />Connect Google</Button><Button variant="outline" disabled={pending} onClick={() => run(signOutOtherSessions, "Other sessions signed out")}><KeyRound className="size-4" />Sign out other devices</Button><form action={signOutEverywhere}><Button type="submit" variant="destructive">Sign out everywhere</Button></form></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Revoked access tokens can remain valid until their short expiry. Sensitive operations validate the active authenticated user.</p><div className="mt-6 border-t border-border pt-5"><h3 className="font-semibold text-ink">Active sessions</h3><div className="mt-3 divide-y divide-border border-y border-border">{sessions.map((session) => <div key={session.id} className="flex min-h-14 items-center justify-between gap-4 py-3"><div><p className="max-w-[55ch] truncate text-sm font-semibold text-ink">{session.userAgent || "Unknown device"}</p><p className="mt-1 text-xs text-muted-foreground">Last active {formatDate(session.updatedAt || session.createdAt || new Date().toISOString())}</p></div>{session.isCurrent ? <StatusBadge tone="success">Current</StatusBadge> : <StatusBadge tone="neutral">Other device</StatusBadge>}</div>)}</div></div><UserMfaControls initialFactors={mfaFactors} /></section>

        <section id="reports" className="scroll-mt-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)]"><Flag className="size-5 text-forest" /><h2 className="mt-3 text-xl font-semibold text-ink">My reports</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Internal notes and private enforcement details are never shown here.</p>{reports.length ? <div className="mt-5 divide-y divide-border border-y border-border">{reports.map((report) => <div key={report.id} className="flex min-h-16 items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-ink">{report.targetKind}: {report.category.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(report.createdAt)}</p></div><StatusBadge tone={report.status === "resolved" ? "success" : report.status === "dismissed" ? "neutral" : "info"}>{report.status.replaceAll("_", " ")}</StatusBadge></div>)}</div> : <p className="mt-5 text-sm text-muted-foreground">No reports submitted.</p>}</section>
      </div>
    </div>
  );
}

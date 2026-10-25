"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";

import {
  createOrganization,
  createOrganizationOffice,
  inviteOrganizationMember,
  revokeOrganizationMember,
} from "./actions";

type Office = { id: string; name: string; address: string | null; is_default: boolean };
type Member = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "agent";
  profiles: { full_name?: string | null; email?: string } | Array<{ full_name?: string | null; email?: string }>;
};
type Invitation = { id: string; email: string; role: "admin" | "agent"; expires_at: string };

export function OrganizationManagement({
  organization,
  offices,
  members,
  invitations,
}: {
  organization: { organizationName: string; role: "owner" | "admin" | "agent" } | null;
  offices: Office[];
  members: Member[];
  invitations: Invitation[];
}) {
  const ready = useWorkspaceReady();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [officeId, setOfficeId] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");

  if (!organization) {
    return (
      <fieldset disabled={!ready || pending} className="min-w-0 border-0 p-0">
      <section className="min-w-0 rounded-xl border border-border bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink">Create an organization</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your existing personal listings stay personal and remain visible in your dashboard.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">Name<Input className="mt-1" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label>
          <label className="text-xs font-semibold text-muted-foreground">URL slug<Input className="mt-1" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-"))} /></label>
        </div>
        <Button className="mt-4" disabled={pending || !organizationName || !slug} onClick={() => startTransition(async () => {
          const result = await createOrganization({ name: organizationName, slug });
          setMessage(result.success ? "Organization created. Refreshing your workspace…" : result.error);
          if (result.success) window.location.reload();
        })}>Create organization</Button>
        {message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      </section>
      </fieldset>
    );
  }

  const profileOf = (member: Member) => Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
  return (
    <fieldset disabled={!ready || pending} className="min-w-0 border-0 p-0">
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-border bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink">Members</h2>
        <p className="mt-1 text-sm text-muted-foreground">Agents only manage assigned listings. Admins can manage organization listings and imports.</p>
        <div className="mt-4 divide-y divide-border rounded-md border border-border">
          {members.map((member) => {
            const profile = profileOf(member);
            const canRevoke = member.role !== "owner" && (organization.role === "owner" || member.role === "agent");
            return (
              <div key={member.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{profile?.full_name || profile?.email || "Member"}</p><p className="text-xs capitalize text-muted-foreground">{member.role}</p></div>
                {canRevoke ? <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
                  const result = await revokeOrganizationMember(member.id);
                  setMessage(result.success ? "Membership revoked." : result.error);
                })}>Revoke</Button> : null}
              </div>
            );
          })}
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-ink">Invite a member</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="agent@example.com" />
            <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "agent")} className="h-11 rounded-md border border-input bg-panel px-3 text-sm">
              <option value="agent">Agent</option>
              {organization.role === "owner" ? <option value="admin">Admin</option> : null}
            </select>
            <select value={officeId} onChange={(event) => setOfficeId(event.target.value)} className="h-11 rounded-md border border-input bg-panel px-3 text-sm sm:col-span-2">
              <option value="">No office assignment</option>
              {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
          </div>
          <Button className="mt-3" disabled={pending || !email} onClick={() => startTransition(async () => {
            const result = await inviteOrganizationMember({ email, role, officeId: officeId || null });
            if (!result.success) setMessage(result.error);
            else {
              setInviteUrl(result.data.inviteUrl);
              setMessage("Invitation created. Copy this one-time link and send it securely.");
            }
          })}>Create seven-day invitation</Button>
          {inviteUrl ? <Input readOnly value={inviteUrl} className="mt-3 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} /> : null}
          {invitations.length ? <p className="mt-3 text-xs text-muted-foreground">{invitations.length} invitation{invitations.length === 1 ? "" : "s"} awaiting acceptance.</p> : null}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink">Offices</h2>
        <div className="mt-4 divide-y divide-border rounded-md border border-border">
          {offices.length ? offices.map((office) => (
            <div key={office.id} className="px-3 py-3"><p className="text-sm font-semibold text-ink">{office.name}{office.is_default ? " · Default" : ""}</p><p className="text-xs text-muted-foreground">{office.address || "No address"}</p></div>
          )) : <p className="p-3 text-sm text-muted-foreground">No offices added yet.</p>}
        </div>
        <div className="mt-5 grid gap-3">
          <label className="text-xs font-semibold text-muted-foreground">Office name<Input className="mt-1" value={officeName} onChange={(event) => setOfficeName(event.target.value)} /></label>
          <label className="text-xs font-semibold text-muted-foreground">Address<Input className="mt-1" value={officeAddress} onChange={(event) => setOfficeAddress(event.target.value)} /></label>
          <Button disabled={pending || !officeName} onClick={() => startTransition(async () => {
            const result = await createOrganizationOffice({ name: officeName, address: officeAddress });
            setMessage(result.success ? "Office added." : result.error);
            if (result.success) {
              setOfficeName("");
              setOfficeAddress("");
            }
          })}>Add office</Button>
        </div>
      </section>
      {message ? <p role="status" className="text-sm font-medium text-muted-foreground lg:col-span-2">{message}</p> : null}
    </div>
    </fieldset>
  );
}

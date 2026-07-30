"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Database,
  Download,
  ExternalLink,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  setProfileRelationshipAction,
  updateAccountIdentityAction,
  updateNormalizedNotificationPreferenceAction,
  updateProfilePrivacyAction,
} from "@/features/profile/actions";
import { PasskeyControls } from "@/features/profile/components/passkey-controls";
import type { SettingsSection } from "@/features/profile/settings-data";
import {
  cancelPrivacyRequest,
  requestDataExport,
  signOutEverywhere,
  signOutOtherSessions,
  submitPrivacyRequest,
} from "@/features/trust/settings-actions";
import { UserMfaControls } from "@/features/trust/components/user-mfa-controls";
import { createClient } from "@/lib/supabase/browser";

type Data = Awaited<
  ReturnType<
    typeof import("@/features/profile/settings-data").getProfileSettingsData
  >
>;

const titles: Record<SettingsSection, [string, string, string]> = {
  profile: [
    "Profile",
    "Identity and preferences",
    "Manage your public-safe identity and marketplace personas.",
  ],
  privacy: [
    "Privacy & data",
    "Visibility and POPIA",
    "Control audiences, relationships, consent history, and profile versions.",
  ],
  notifications: [
    "Notifications",
    "Channel and frequency",
    "Choose in-app or email delivery by category.",
  ],
  security: [
    "Security",
    "Protect your account",
    "Manage credentials, MFA, sessions, recognized devices, and security history.",
  ],
  connections: [
    "Connected accounts",
    "Ways to sign in",
    "Manage OAuth identities and feature-flagged passkeys.",
  ],
  account: [
    "Account management",
    "Exports and deletion",
    "Download your information or submit a tracked account request.",
  ],
};

export function SettingsSectionView({
  section,
  data,
}: {
  section: SettingsSection;
  data: Data;
}) {
  const [eyebrow, title, description] = titles[section];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </header>
      {section === "profile" ? <ProfileSettings data={data} /> : null}
      {section === "privacy" ? <PrivacySettings data={data} /> : null}
      {section === "notifications" ? (
        <NotificationSettings data={data} />
      ) : null}
      {section === "security" ? <SecuritySettings data={data} /> : null}
      {section === "connections" ? <ConnectionSettings data={data} /> : null}
      {section === "account" ? <AccountSettings data={data} /> : null}
    </div>
  );
}

function ProfileSettings({ data }: { data: Data }) {
  return (
    <section className="border-y border-border py-6">
      <UserRound className="size-5 text-forest" />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-ink">
            {data.profile.displayName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            @{data.profile.username} · {data.profile.email}
          </p>
        </div>
        <Button render={<Link href="/profile/edit" />}>Edit profile</Button>
      </div>
      <div className="mt-6 grid border-l border-t border-border sm:grid-cols-2">
        {data.profile.personas.map((persona) => (
          <div
            key={persona.persona}
            className="border-b border-r border-border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold capitalize text-ink">
                {persona.persona}
              </p>
              {persona.isActive ? (
                <StatusBadge tone="forest">Active</StatusBadge>
              ) : null}
            </div>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {persona.completion}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Required fields complete
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PrivacySettings({ data }: { data: Data }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [privacy, setPrivacy] = useState(data.profile.visibility);
  const select = (
    label: string,
    key: "profile" | "messaging" | "phone" | "email",
    options: string[],
  ) => (
    <label className="grid gap-2 border-b border-border py-4 text-sm font-semibold text-ink">
      {label}
      <select
        value={privacy[key]}
        onChange={(event) =>
          setPrivacy((current) => ({ ...current, [key]: event.target.value }))
        }
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  function removeRelationship(
    profileId: string,
    relationship: "block" | "mute",
  ) {
    startTransition(async () => {
      const result = await setProfileRelationshipAction({
        profileId,
        relationship,
        enabled: false,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        relationship === "block" ? "Profile unblocked" : "Profile unmuted",
      );
      router.refresh();
    });
  }
  return (
    <div className="space-y-10">
      <section>
        <LockKeyhole className="size-5 text-forest" />
        <h3 className="mt-3 text-lg font-semibold text-ink">
          Field visibility
        </h3>
        <div className="mt-3 border-y border-border">
          {select("Public profile", "profile", [
            "everyone",
            "members",
            "interactions",
            "no_one",
          ])}
          {select("Messages", "messaging", [
            "everyone",
            "members",
            "interactions",
            "no_one",
          ])}
          {select("Phone", "phone", ["members", "interactions", "no_one"])}
          {select("Email", "email", ["members", "interactions", "no_one"])}
          {(
            [
              ["reviews", "Show verified reviews"],
              ["activity", "Show generic public activity"],
              ["searchIndexed", "Allow search engine indexing"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex min-h-14 items-center justify-between gap-4 border-b border-border py-3 text-sm font-semibold text-ink last:border-b-0"
            >
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(privacy[key as keyof typeof privacy])}
                onChange={(event) =>
                  setPrivacy((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                className="size-5 accent-[var(--forest)]"
              />
            </label>
          ))}
        </div>
        <Button
          className="mt-4"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateProfilePrivacyAction({
                profile: privacy.profile,
                messaging: privacy.messaging,
                phone: privacy.phone,
                email: privacy.email,
                reviews: privacy.reviews,
                activity: privacy.activity,
                searchIndexed: privacy.searchIndexed,
              });
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Privacy settings saved");
              router.refresh();
            })
          }
        >
          Confirm privacy changes
        </Button>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Blocked profiles</h3>
        {data.blocks.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.blocks.map((row) => (
              <li
                key={row.blocked_id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {row.profile?.display_name ?? "Unavailable profile"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{row.profile?.username ?? "hidden"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => removeRelationship(row.blocked_id, "block")}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            You have not blocked anyone.
          </p>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Muted profiles</h3>
        {data.mutes.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.mutes.map((row) => (
              <li
                key={row.muted_id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <p className="text-sm font-semibold text-ink">
                  {row.profile?.display_name ?? "Unavailable profile"}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => removeRelationship(row.muted_id, "mute")}
                >
                  Unmute
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            You have not muted anyone.
          </p>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Consent history</h3>
        {data.consentHistory.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.consentHistory.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {event.consent_key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.source} ·{" "}
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                    }).format(new Date(event.created_at))}
                  </p>
                </div>
                <StatusBadge tone={event.granted ? "success" : "neutral"}>
                  {event.granted ? "granted" : "withdrawn"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No optional consent events yet.
          </p>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">
          Profile version history
        </h3>
        {data.profileVersions.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.profileVersions.map((version) => (
              <li key={version.id} className="py-3">
                <p className="text-sm font-semibold text-ink">
                  Version {version.version}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {version.changed_fields.join(", ") || "Profile snapshot"} ·{" "}
                  {new Intl.DateTimeFormat("en-ZA", {
                    dateStyle: "medium",
                  }).format(new Date(version.created_at))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Version history starts with your next profile update.
          </p>
        )}
      </section>
    </div>
  );
}

function NotificationSettings({ data }: { data: Data }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(data.subscriptions);
  function update(
    index: number,
    patch: Partial<(typeof data.subscriptions)[number]>,
  ) {
    const next = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    const row = next[index];
    if (!row) return;
    setRows(next);
    startTransition(async () => {
      const result = await updateNormalizedNotificationPreferenceAction(row);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Notification preference saved");
    });
  }
  return (
    <section>
      <Bell className="size-5 text-forest" />
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Security and account-critical in-app alerts stay on. Marketing is
        opt-in.
      </p>
      <div className="mt-5 overflow-x-auto border-y border-border">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-3 pr-4">Category</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Frequency</th>
              <th className="py-3 pl-4 text-right">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const mandatory =
                row.channel === "in_app" &&
                ["security", "account_updates"].includes(row.category);
              return (
                <tr
                  key={`${row.category}-${row.channel}`}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="py-4 pr-4 font-semibold capitalize text-ink">
                    {row.category.replaceAll("_", " ")}
                  </td>
                  <td className="px-4 py-4 capitalize text-muted-foreground">
                    {row.channel.replace("_", " ")}
                  </td>
                  <td className="px-4 py-4">
                    <select
                      aria-label={`${row.category} ${row.channel} frequency`}
                      value={row.frequency}
                      disabled={pending && false}
                      onChange={(event) =>
                        update(index, {
                          frequency: event.target.value as typeof row.frequency,
                          enabled:
                            event.target.value === "never"
                              ? false
                              : row.enabled,
                        })
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3"
                    >
                      <option value="instant">Instant</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="never">Never</option>
                    </select>
                  </td>
                  <td className="py-4 pl-4 text-right">
                    <input
                      aria-label={`Enable ${row.category} ${row.channel}`}
                      type="checkbox"
                      checked={mandatory || row.enabled}
                      disabled={mandatory}
                      onChange={(event) =>
                        update(index, {
                          enabled: event.target.checked,
                          frequency:
                            event.target.checked && row.frequency === "never"
                              ? "instant"
                              : row.frequency,
                        })
                      }
                      className="size-5 accent-[var(--forest)]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SecuritySettings({ data }: { data: Data }) {
  const [pending, startTransition] = useTransition();
  function accountChange(kind: "email" | "phone" | "password", value: string) {
    startTransition(async () => {
      const result = await updateAccountIdentityAction({ kind, value });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        kind === "password"
          ? "Password changed"
          : `${kind} confirmation started`,
      );
    });
  }
  return (
    <div className="space-y-10">
      <section>
        <ShieldCheck className="size-5 text-forest" />
        <h3 className="mt-3 text-lg font-semibold text-ink">
          Account credentials
        </h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <CredentialForm
            label="New email"
            type="email"
            kind="email"
            pending={pending}
            submit={accountChange}
          />
          <CredentialForm
            label="New phone"
            type="tel"
            kind="phone"
            pending={pending}
            submit={accountChange}
          />
          <CredentialForm
            label="New password"
            type="password"
            kind="password"
            pending={pending}
            submit={accountChange}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Sensitive changes require AAL2 or a sign-in from the last 15 minutes.
        </p>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Active sessions</h3>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {data.security.sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <p className="max-w-[50ch] truncate text-sm font-semibold text-ink">
                  {session.userAgent || "Unknown device"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last active{" "}
                  {new Intl.DateTimeFormat("en-ZA", {
                    dateStyle: "medium",
                  }).format(
                    new Date(
                      session.updatedAt ||
                        session.createdAt ||
                        "1970-01-01T00:00:00.000Z",
                    ),
                  )}
                </p>
              </div>
              {session.isCurrent ? (
                <StatusBadge tone="success">Current</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Other</StatusBadge>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                const result = await signOutOtherSessions();
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Other sessions revoked");
              })
            }
          >
            <KeyRound className="size-4" />
            Sign out other devices
          </Button>
          <form action={signOutEverywhere}>
            <Button type="submit" variant="destructive">
              Sign out everywhere
            </Button>
          </form>
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Recognized devices</h3>
        {data.recognizedDevices.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.recognizedDevices.map((device) => (
              <li key={device.id} className="py-3">
                <p className="text-sm font-semibold text-ink">{device.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last seen{" "}
                  {new Intl.DateTimeFormat("en-ZA", {
                    dateStyle: "medium",
                  }).format(new Date(device.last_seen_at))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Recognized device labels appear after device registration.
          </p>
        )}
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">
          Recent security events
        </h3>
        {data.securityEvents.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.securityEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {event.event_key.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.occurred_at))}
                  </p>
                </div>
                {event.is_suspicious ? (
                  <StatusBadge tone="error">Review</StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No recent security events.
          </p>
        )}
      </section>
      <UserMfaControls initialFactors={data.security.mfaFactors} />
      <p className="text-sm leading-6 text-muted-foreground">
        Pinpoint does not issue custom recovery codes. Register a separate
        backup TOTP factor for recovery.
      </p>
    </div>
  );
}

function CredentialForm({
  label,
  type,
  kind,
  pending,
  submit,
}: {
  label: string;
  type: string;
  kind: "email" | "phone" | "password";
  pending: boolean;
  submit: (kind: "email" | "phone" | "password", value: string) => void;
}) {
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        submit(kind, String(form.get("value") ?? ""));
      }}
    >
      <Label htmlFor={`credential-${kind}`}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={`credential-${kind}`}
          name="value"
          type={type}
          required
          minLength={kind === "password" ? 12 : undefined}
          className="h-11"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Update
        </Button>
      </div>
    </form>
  );
}

function ConnectionSettings({ data }: { data: Data }) {
  const router = useRouter();
  async function linkGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/connections`,
      },
    });
    if (error) toast.error(error.message);
  }
  async function unlinkIdentity(id: string) {
    const supabase = createClient();
    const { data: identities, error } = await supabase.auth.getUserIdentities();
    if (error) {
      toast.error(error.message);
      return;
    }
    const identity = identities.identities.find((item) => item.id === id);
    if (!identity) {
      toast.error("That identity is no longer connected.");
      return;
    }
    const result = await supabase.auth.unlinkIdentity(identity);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Identity disconnected");
    router.refresh();
  }
  return (
    <div>
      <section>
        <Fingerprint className="size-5 text-forest" />
        <h3 className="mt-3 text-lg font-semibold text-ink">
          Connected sign-in methods
        </h3>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {data.security.identities.map((identity) => (
            <li
              key={identity.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-sm font-semibold capitalize text-ink">
                  {identity.provider}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {identity.email}
                </p>
              </div>
              {data.security.identities.length > 1 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void unlinkIdentity(identity.id)}
                >
                  Disconnect
                </Button>
              ) : (
                <StatusBadge tone="success">Required</StatusBadge>
              )}
            </li>
          ))}
        </ul>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void linkGoogle()}
        >
          <ExternalLink className="size-4" />
          Connect Google
        </Button>
      </section>
      <PasskeyControls
        enabled={process.env.NEXT_PUBLIC_ENABLE_PASSKEYS === "true"}
      />
    </div>
  );
}

function AccountSettings({ data }: { data: Data }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requestType, setRequestType] = useState<
    "correction" | "deletion" | "objection" | "withdraw_consent"
  >("correction");
  const [details, setDetails] = useState("");
  function run(
    work: () => Promise<{ success: boolean; error?: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        toast.error(result.error ?? "Action failed.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }
  return (
    <div className="space-y-10">
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="border-y border-border py-5">
          <Download className="size-5 text-forest" />
          <h3 className="mt-3 text-lg font-semibold text-ink">
            Download my data
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A private archive is prepared asynchronously and expires after seven
            days.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={pending}
            onClick={() => run(requestDataExport, "Export requested")}
          >
            <Download className="size-4" />
            Request export
          </Button>
        </div>
        <div className="border-y border-border py-5">
          <Database className="size-5 text-forest" />
          <h3 className="mt-3 text-lg font-semibold text-ink">
            Tracked request
          </h3>
          <select
            value={requestType}
            onChange={(event) =>
              setRequestType(event.target.value as typeof requestType)
            }
            className="mt-3 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="correction">Correct my information</option>
            <option value="deletion">
              Delete my account and eligible data
            </option>
            <option value="objection">Object to processing</option>
            <option value="withdraw_consent">Withdraw consent</option>
          </select>
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            minLength={20}
            maxLength={5000}
            className="mt-3"
            placeholder="Explain what the privacy team should review."
          />
          <Button
            className="mt-3"
            variant={requestType === "deletion" ? "destructive" : "default"}
            disabled={pending || details.trim().length < 20}
            onClick={() =>
              run(
                () => submitPrivacyRequest({ requestType, details }),
                "Request submitted",
              )
            }
          >
            Submit request
          </Button>
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-ink">Request history</h3>
        {data.trust.privacyRequests.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {data.trust.privacyRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {request.requestType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted{" "}
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                    }).format(new Date(request.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    tone={
                      request.status === "completed" ? "success" : "neutral"
                    }
                  >
                    {request.status.replaceAll("_", " ")}
                  </StatusBadge>
                  {["submitted", "waiting_on_user"].includes(request.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => cancelPrivacyRequest(request.id),
                          "Request cancelled",
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No privacy requests yet.
          </p>
        )}
      </section>
      <p className="text-sm leading-6 text-muted-foreground">
        Account deletion remains a tracked manual workflow so legal retention,
        active transactions, and security obligations can be reviewed safely.
      </p>
    </div>
  );
}

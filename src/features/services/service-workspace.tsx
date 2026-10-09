"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { Button } from "@/components/ui/button";
import {
  serviceContentSchema,
  serviceDraftSchema,
  serviceTypes,
  type ServiceDraft,
} from "./schema";
import { z } from "zod";
import type { serviceSubmissionSchema } from "./schema";
type Submission = z.infer<typeof serviceSubmissionSchema>;
async function request(
  command: string,
  id: string,
  expectedVersion: number,
  draft?: ServiceDraft,
) {
  const response = await fetch("/api/private/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      command,
      id,
      expectedVersion,
      ...(draft ? { draft } : {}),
      permissionConfirmed: command === "submit",
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    if (result.nextPath) window.location.assign(result.nextPath);
    throw new Error(result.error ?? "Could not save this service.");
  }
  return result as { id: string; version: number; status: string };
}
export function NewServiceButton() {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        disabled={pending || !ready}
        onClick={async () => {
          setPending(true);
          setError("");
          const id = crypto.randomUUID();
          try {
            await request("create", id, 0);
            router.push("/post/services/" + id);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not create a service.",
            );
            setPending(false);
          }
        }}
      >
        Add service
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
const labels = {
  title: "Service title",
  providerName: "Provider or business name",
  description: "What you offer",
  address: "Street address",
  phone: "Public phone number",
  latitude: "Service latitude",
  longitude: "Service longitude",
};
const control =
  "min-h-11 w-full min-w-0 rounded-lg border border-border bg-panel px-3 py-2 text-sm";
export function ServiceEditor({ initial }: { initial: Submission }) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [values, setValues] = useState<Record<keyof typeof labels, string>>(
    () =>
      Object.fromEntries(
        Object.keys(labels).map((key) => [
          key,
          String(initial.draft[key as keyof ServiceDraft] ?? ""),
        ]),
      ) as Record<keyof typeof labels, string>,
  );
  const [areaId, setAreaId] = useState(initial.draft.areaId ?? "");
  const [areaLabel, setAreaLabel] = useState("");
  const [type, setType] = useState(initial.draft.serviceType ?? "");
  const [version, setVersion] = useState(initial.version);
  const [status, setStatus] = useState(initial.status);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const draft = () => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values))
      if (value.trim())
        result[key] =
          key === "latitude" || key === "longitude" ? Number(value) : value;
    if (areaId) result.areaId = areaId;
    if (type) result.serviceType = type;
    return serviceDraftSchema.parse(result);
  };
  const mutate = async (command: "save" | "submit" | "withdraw") => {
    setPending(true);
    setError("");
    setMessage("");
    try {
      let currentVersion = version;
      if (command !== "withdraw") {
        const next = draft();
        if (command === "submit") {
          serviceContentSchema.parse(next);
          if (!consent)
            throw new Error(
              "Confirm permission to publish the provider details.",
            );
        }
        const saved = await request("save", initial.id, currentVersion, next);
        currentVersion = saved.version;
        setVersion(saved.version);
        setStatus(saved.status as Submission["status"]);
        setDirty(false);
      }
      if (command !== "save") {
        const result = await request(command, initial.id, currentVersion);
        setVersion(result.version);
        setStatus(result.status as Submission["status"]);
      }
      setMessage(
        command === "submit"
          ? "Submitted privately for review. It becomes public only after approval."
          : command === "withdraw"
            ? "Withdrawn from review and public discovery."
            : "Private draft saved.",
      );
    } catch (error) {
      setError(
        error instanceof z.ZodError
          ? "Complete the service details, phone number, discovery area and valid coordinates before submitting."
          : error instanceof Error
            ? error.message
            : "Could not save this service.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-6">
      <Link
        href="/post/services"
        className="inline-flex min-h-11 items-center text-sm text-forest underline"
      >
        Your services
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Service details</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {status}. Save a private draft, then submit it for approval.
        </p>
        {dirty ? (
          <p className="mt-2 text-sm">You have unsaved changes.</p>
        ) : null}
      </header>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void mutate("save");
        }}
      >
        <fieldset
          disabled={pending || !ready || status === "submitted"}
          className="grid gap-5 sm:grid-cols-2"
        >
          <legend className="sr-only">Provider details</legend>
          {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
            <label
              key={key}
              className={
                "grid gap-2 text-sm font-medium " +
                (key === "description" || key === "address"
                  ? "sm:col-span-2"
                  : "")
              }
            >
              {labels[key]}
              {key === "description" ? (
                <textarea
                  className={control + " min-h-32"}
                  maxLength={4000}
                  value={values[key]}
                  onChange={(event) => {
                    setValues({ ...values, [key]: event.target.value });
                    setDirty(true);
                  }}
                />
              ) : (
                <input
                  className={control}
                  type={
                    key === "latitude" || key === "longitude"
                      ? "number"
                      : key === "phone"
                        ? "tel"
                        : "text"
                  }
                  step="any"
                  maxLength={
                    key === "address" ? 500 : key === "phone" ? 24 : 160
                  }
                  value={values[key]}
                  onChange={(event) => {
                    setValues({ ...values, [key]: event.target.value });
                    setDirty(true);
                  }}
                />
              )}
            </label>
          ))}
          <label className="grid gap-2 text-sm font-medium">
            Service type
            <select
              aria-label="Service type"
              className={control}
              value={type}
              onChange={(event) => {
                setType(event.target.value as typeof type);
                setDirty(true);
              }}
            >
              <option value="">Choose a service type</option>
              {serviceTypes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Discovery area</p>
            <LocationSelector
              idPrefix="service-intake"
              selectedLocation={
                areaLabel || (areaId ? "Selected area" : undefined)
              }
              onSelect={(place) => {
                setAreaId(place.id);
                setAreaLabel(place.label);
                setDirty(true);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Use the provider’s actual address and coordinates. The area selector
            chooses where the service appears; it does not set the provider’s
            map pin.
          </p>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-5"
            />
            I have permission to publish this provider’s service, location and
            phone number after approval.
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={pending || !ready || status === "submitted"}
          >
            Save private draft
          </Button>
          <Button
            type="button"
            disabled={pending || !ready || status === "submitted"}
            onClick={() => void mutate("submit")}
          >
            Submit for review
          </Button>
          {status !== "withdrawn" ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || !ready}
              onClick={() => void mutate("withdraw")}
            >
              Withdraw service
            </Button>
          ) : null}
        </div>
      </form>
      {status === "submitted" ? (
        <p className="text-sm text-muted-foreground">
          Your submitted details are locked during review. Withdraw to edit
          them; withdrawing also removes any prior approved version from
          discovery.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        An existing approved version stays public while you save changes or
        submit an update for review.
      </p>
      {error ? (
        <p role="alert" className="rounded-xl border border-border p-4 text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-forest">
          {message}
        </p>
      ) : null}
    </div>
  );
}

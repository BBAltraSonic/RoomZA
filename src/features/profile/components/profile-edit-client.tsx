"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updatePersonaDetailsAction,
  updatePublicIdentityAction,
} from "@/features/profile/actions";
import type { PrivateProfile } from "@/features/profile/types";
import {
  marketplacePersonaLabels,
  type MarketplacePersona,
} from "@/lib/personas";

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? Number(text) : null;
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${name}-${String(defaultValue ?? "")}`}>{label}</Label>
      <Input
        id={`${name}-${String(defaultValue ?? "")}`}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="h-11"
      />
    </div>
  );
}

export function ProfileEditClient({
  initialProfile,
}: {
  initialProfile: PrivateProfile;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [profile, setProfile] = useState(initialProfile);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  function saveIdentity() {
    setSaveState("saving");
    startTransition(async () => {
      const result = await updatePublicIdentityAction({
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl ?? "",
        bio: profile.bio ?? "",
        languages: profile.languages,
      });
      if (!result.success) {
        setSaveState("error");
        toast.error(result.error);
        return;
      }
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
      router.refresh();
    });
  }

  function savePersona(persona: MarketplacePersona, formData: FormData) {
    let details: Record<string, unknown>;
    if (persona === "renter") {
      details = {
        occupation: textOrNull(formData.get("occupation")),
        employer: textOrNull(formData.get("employer")),
        monthlyIncome: numberOrNull(formData.get("monthlyIncome")),
        rentBudgetMin: numberOrNull(formData.get("rentBudgetMin")),
        rentBudgetMax: numberOrNull(formData.get("rentBudgetMax")),
        preferredAreas: splitList(formData.get("preferredAreas")),
        moveInDate: textOrNull(formData.get("moveInDate")),
        householdSize: numberOrNull(formData.get("householdSize")),
        hasPets:
          textOrNull(formData.get("hasPets")) === null
            ? null
            : formData.get("hasPets") === "yes",
        smokingPreference: textOrNull(formData.get("smokingPreference")),
        studentStatus:
          textOrNull(formData.get("studentStatus")) === null
            ? null
            : formData.get("studentStatus") === "yes",
        nsfasEligible:
          textOrNull(formData.get("nsfasEligible")) === null
            ? null
            : formData.get("nsfasEligible") === "yes",
        governmentAssistance:
          textOrNull(formData.get("governmentAssistance")) === null
            ? null
            : formData.get("governmentAssistance") === "yes",
      };
    } else if (persona === "buyer") {
      details = {
        buyingBudget: numberOrNull(formData.get("buyingBudget")),
        depositSaved: numberOrNull(formData.get("depositSaved")),
        bondStatus: textOrNull(formData.get("bondStatus")),
        mortgageProvider: textOrNull(formData.get("mortgageProvider")),
        buyingTimeline: textOrNull(formData.get("buyingTimeline")),
        preferredSuburbs: splitList(formData.get("preferredSuburbs")),
        propertyGoals: splitList(formData.get("propertyGoals")),
        purchasePurpose: textOrNull(formData.get("purchasePurpose")),
      };
    } else if (persona === "landlord") {
      details = {
        businessName: textOrNull(formData.get("businessName")),
        companyLogoUrl: String(formData.get("companyLogoUrl") ?? ""),
        portfolioSize: numberOrNull(formData.get("portfolioSize")),
        yearsManaging: numberOrNull(formData.get("yearsManaging")),
        ownerType: textOrNull(formData.get("ownerType")),
        officeLocation: textOrNull(formData.get("officeLocation")),
        licenseDetails: textOrNull(formData.get("licenseDetails")),
      };
    } else {
      details = {
        businessName: textOrNull(formData.get("businessName")),
        companyLogoUrl: String(formData.get("companyLogoUrl") ?? ""),
        officeLocation: textOrNull(formData.get("officeLocation")),
        propertySpecialties: splitList(formData.get("propertySpecialties")),
      };
    }
    startTransition(async () => {
      const result = await updatePersonaDetailsAction({ persona, details });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${marketplacePersonaLabels[persona]} details saved`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="public-identity-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              Public-safe identity
            </p>
            <h2
              id="public-identity-heading"
              className="mt-2 text-xl font-semibold text-ink"
            >
              How people see you
            </h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">
              Income, budgets, security details, and documents never appear
              here.
            </p>
          </div>
          <span
            aria-live="polite"
            className="text-xs font-semibold text-muted-foreground"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Not saved"
                  : "Autosaves on blur"}
          </span>
        </div>
        <div className="mt-5 grid gap-5 border-y border-border py-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={profile.displayName}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              onBlur={saveIdentity}
              maxLength={100}
              className="h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  username: event.target.value.toLowerCase(),
                }))
              }
              pattern="[a-z0-9_]{3,30}"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Changing your public URL requires a recent sign-in.
            </p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="avatar-url">Avatar URL</Label>
            <Input
              id="avatar-url"
              type="url"
              value={profile.avatarUrl ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  avatarUrl: event.target.value || null,
                }))
              }
              onBlur={saveIdentity}
              className="h-11"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={profile.bio ?? ""}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  bio: event.target.value || null,
                }))
              }
              onBlur={saveIdentity}
              maxLength={1000}
              className="min-h-28"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="languages">Languages</Label>
            <Input
              id="languages"
              value={profile.languages.join(", ")}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  languages: splitList(event.target.value),
                }))
              }
              onBlur={saveIdentity}
              placeholder="English, isiZulu, Afrikaans"
              className="h-11"
            />
          </div>
        </div>
        <Button className="mt-4" disabled={pending} onClick={saveIdentity}>
          {saveState === "saved" ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          Save identity
        </Button>
      </section>

      <section aria-labelledby="personas-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              Property details
            </p>
            <h2
              id="personas-heading"
              className="mt-2 text-xl font-semibold text-ink"
            >
              Details for your next property transaction
            </h2>
          </div>

        </div>

        <div className="mt-6 space-y-8">
          {profile.personas.map(({ persona, completion }) => {
            const renterDetails =
              persona === "renter" ? profile.personaDetails.renter : null;
            const buyerDetails =
              persona === "buyer" ? profile.personaDetails.buyer : null;
            const landlordDetails =
              persona === "landlord" ? profile.personaDetails.landlord : null;
            const sellerDetails =
              persona === "seller" ? profile.personaDetails.seller : null;
            return (
              <form
                key={persona}
                action={(data) => savePersona(persona, data)}
                className="border-t border-border pt-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-ink">
                    {marketplacePersonaLabels[persona]} details
                  </h3>
                  <span className="text-xs font-semibold text-forest">
                    {completion}% complete
                  </span>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {persona === "renter" ? (
                    <>
                      <Field
                        label="Occupation"
                        name="occupation"
                        defaultValue={renterDetails?.occupation}
                      />
                      <Field
                        label="Employer"
                        name="employer"
                        defaultValue={renterDetails?.employer}
                      />
                      <Field
                        label="Monthly income (private)"
                        name="monthlyIncome"
                        type="number"
                        defaultValue={renterDetails?.monthlyIncome}
                      />
                      <Field
                        label="Minimum rent budget"
                        name="rentBudgetMin"
                        type="number"
                        defaultValue={renterDetails?.rentBudgetMin}
                      />
                      <Field
                        label="Maximum rent budget"
                        name="rentBudgetMax"
                        type="number"
                        defaultValue={renterDetails?.rentBudgetMax}
                      />
                      <Field
                        label="Preferred areas"
                        name="preferredAreas"
                        defaultValue={renterDetails?.preferredAreas?.join(", ")}
                      />
                      <Field
                        label="Move-in date"
                        name="moveInDate"
                        type="date"
                        defaultValue={renterDetails?.moveInDate}
                      />
                      <Field
                        label="Household size"
                        name="householdSize"
                        type="number"
                        defaultValue={renterDetails?.householdSize}
                      />
                      <Choice
                        label="Pets"
                        name="hasPets"
                        value={renterDetails?.hasPets ?? null}
                      />
                      <SelectField
                        label="Smoking preference"
                        name="smokingPreference"
                        value={renterDetails?.smokingPreference ?? null}
                        options={[
                          ["non_smoker", "Non-smoker"],
                          ["smoker", "Smoker"],
                          ["outdoors_only", "Outdoors only"],
                        ]}
                      />
                      <Choice
                        label="Student"
                        name="studentStatus"
                        value={renterDetails?.studentStatus ?? null}
                      />
                      <Choice
                        label="NSFAS eligible"
                        name="nsfasEligible"
                        value={renterDetails?.nsfasEligible ?? null}
                      />
                      <Choice
                        label="Government assistance"
                        name="governmentAssistance"
                        value={renterDetails?.governmentAssistance ?? null}
                      />
                    </>
                  ) : null}
                  {persona === "buyer" ? (
                    <>
                      <Field
                        label="Buying budget"
                        name="buyingBudget"
                        type="number"
                        defaultValue={buyerDetails?.buyingBudget}
                      />
                      <Field
                        label="Deposit saved"
                        name="depositSaved"
                        type="number"
                        defaultValue={buyerDetails?.depositSaved}
                      />
                      <SelectField
                        label="Bond status"
                        name="bondStatus"
                        value={buyerDetails?.bondStatus ?? null}
                        options={[
                          ["not_started", "Not started"],
                          ["preparing", "Preparing"],
                          ["pre_approved", "Pre-approved"],
                          ["approved", "Approved"],
                        ]}
                      />
                      <Field
                        label="Mortgage provider"
                        name="mortgageProvider"
                        defaultValue={buyerDetails?.mortgageProvider}
                      />
                      <SelectField
                        label="Buying timeline"
                        name="buyingTimeline"
                        value={buyerDetails?.buyingTimeline ?? null}
                        options={[
                          ["now", "Now"],
                          ["three_months", "Within 3 months"],
                          ["six_months", "Within 6 months"],
                          ["twelve_months", "Within 12 months"],
                          ["exploring", "Exploring"],
                        ]}
                      />
                      <Field
                        label="Preferred suburbs"
                        name="preferredSuburbs"
                        defaultValue={buyerDetails?.preferredSuburbs?.join(
                          ", ",
                        )}
                      />
                      <Field
                        label="Property goals"
                        name="propertyGoals"
                        defaultValue={buyerDetails?.propertyGoals?.join(", ")}
                      />
                      <SelectField
                        label="Purchase purpose"
                        name="purchasePurpose"
                        value={buyerDetails?.purchasePurpose ?? null}
                        options={[
                          ["residential", "Residential"],
                          ["investment", "Investment"],
                          ["both", "Both"],
                        ]}
                      />
                    </>
                  ) : null}
                  {persona === "landlord" ? (
                    <>
                      <Field
                        label="Business name"
                        name="businessName"
                        defaultValue={landlordDetails?.businessName}
                      />
                      <Field
                        label="Company logo URL"
                        name="companyLogoUrl"
                        type="url"
                        defaultValue={landlordDetails?.companyLogoUrl}
                      />
                      <Field
                        label="Portfolio size"
                        name="portfolioSize"
                        type="number"
                        defaultValue={landlordDetails?.portfolioSize}
                      />
                      <Field
                        label="Years managing"
                        name="yearsManaging"
                        type="number"
                        defaultValue={landlordDetails?.yearsManaging}
                      />
                      <SelectField
                        label="Owner type"
                        name="ownerType"
                        value={landlordDetails?.ownerType ?? null}
                        options={[
                          ["private_owner", "Private owner"],
                          ["agency", "Agency"],
                        ]}
                      />
                      <Field
                        label="Office location"
                        name="officeLocation"
                        defaultValue={landlordDetails?.officeLocation}
                      />
                      <Field
                        label="License details"
                        name="licenseDetails"
                        defaultValue={landlordDetails?.licenseDetails}
                      />
                    </>
                  ) : null}
                  {persona === "seller" ? (
                    <>
                      <Field
                        label="Business name"
                        name="businessName"
                        defaultValue={sellerDetails?.businessName}
                      />
                      <Field
                        label="Company logo URL"
                        name="companyLogoUrl"
                        type="url"
                        defaultValue={sellerDetails?.companyLogoUrl}
                      />
                      <Field
                        label="Office location"
                        name="officeLocation"
                        defaultValue={sellerDetails?.officeLocation}
                      />
                      <Field
                        label="Property specialties"
                        name="propertySpecialties"
                        defaultValue={sellerDetails?.propertySpecialties?.join(
                          ", ",
                        )}
                      />
                    </>
                  ) : null}
                </div>
                <Button type="submit" className="mt-5" disabled={pending}>
                  Save {marketplacePersonaLabels[persona].toLowerCase()} details
                </Button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Choice({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: boolean | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value === null ? "" : value ? "yes" : "no"}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
      >
        <option value="">Prefer not to say</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string | null;
  options: Array<[string, string]>;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
      >
        <option value="">Not set</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

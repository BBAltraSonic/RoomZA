"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { createListingDraft } from "./actions";
import { LocationPickerLoader } from "./location-picker-loader";
import { listingTypeLabels, listingTypes, propertyTypeLabels, propertyTypes } from "./schema";

export function ListingDraftForm({ googleMapsApiKey }: { googleMapsApiKey?: string }) {
  const router = useRouter();
  const [listingType, setListingType] = useState<(typeof listingTypes)[number]>("rent");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function fieldError(name: string) {
    const message = errors[name]?.[0];
    return message ? <p className="mt-1.5 text-sm font-medium text-destructive">{message}</p> : null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setErrors({});

    startTransition(async () => {
      const result = await createListingDraft(formData);
      if (!result.success) {
        setErrors(result.details?.fieldErrors ?? { _form: [result.error] });
        return;
      }

      toast.success("Draft created", {
        description: "Add photos and complete the remaining details when you are ready.",
      });
      router.push(`/dashboard/listings/${result.data.listingId}/edit#gallery`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--elevation-1)] sm:rounded-xl">
      <div className="border-b border-border px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-semibold uppercase text-clay">Step 1 of 2</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Start with the essentials</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          This creates a private draft. Photos, utilities, amenities, and lease details come next.
        </p>
      </div>

      <div className="space-y-7 px-5 py-6 sm:px-7">
        {errors._form ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            {errors._form[0]}
          </div>
        ) : null}

        <div>
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Listing type</Label>
          <div className="mt-2 grid grid-cols-2 rounded-lg border border-border bg-muted/20 p-1" role="group" aria-label="Listing type">
            {listingTypes.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={listingType === value}
                onClick={() => setListingType(value)}
                className={cn(
                  "min-h-11 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  listingType === value ? "bg-background text-forest shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-ink",
                )}
              >
                {listingTypeLabels[value]}
              </button>
            ))}
          </div>
          <input type="hidden" name="listing_type" value={listingType} />
          {fieldError("listing_type")}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title" className="text-xs font-semibold uppercase text-muted-foreground">Listing headline</Label>
            <Input
              id="title"
              name="title"
              placeholder="Sunny 2 bedroom home in Rosebank"
              className="mt-2 h-11 bg-background text-base shadow-none"
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
            />
            {fieldError("title")}
          </div>

          <div>
            <Label htmlFor="property_type" className="text-xs font-semibold uppercase text-muted-foreground">Property type</Label>
            <Select name="property_type">
              <SelectTrigger id="property_type" className="mt-2 h-11 w-full bg-background shadow-none" aria-invalid={Boolean(errors.property_type)}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map((value) => <SelectItem key={value} value={value}>{propertyTypeLabels[value]}</SelectItem>)}
              </SelectContent>
            </Select>
            {fieldError("property_type")}
          </div>

          <div>
            <Label htmlFor={listingType === "sale" ? "sale_price" : "price"} className="text-xs font-semibold uppercase text-muted-foreground">
              {listingType === "sale" ? "Purchase price (ZAR)" : "Monthly rent (ZAR)"}
            </Label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R</span>
              <Input
                id={listingType === "sale" ? "sale_price" : "price"}
                name={listingType === "sale" ? "sale_price" : "price"}
                type="number"
                min={1}
                placeholder={listingType === "sale" ? "1850000" : "12000"}
                className="h-11 bg-background pl-9 shadow-none"
                aria-invalid={Boolean(errors[listingType === "sale" ? "sale_price" : "price"])}
              />
              <input type="hidden" name={listingType === "sale" ? "price" : "sale_price"} value="" />
            </div>
            {fieldError(listingType === "sale" ? "sale_price" : "price")}
          </div>
        </div>

        <div className="border-t border-border pt-7">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-forest">
              <MapPin className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">Place the property</h3>
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">Search the address, then adjust the pin if needed.</p>
            </div>
          </div>
          {googleMapsApiKey ? (
            <LocationPickerLoader apiKey={googleMapsApiKey} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              The location picker is unavailable because Google Maps is not configured.
            </div>
          )}
          {fieldError("address") || fieldError("latitude") || fieldError("longitude")}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-background/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-xs leading-5 text-muted-foreground">Only you can see this draft until it passes the publish checklist.</p>
        <Button type="submit" disabled={isPending || !googleMapsApiKey} className="h-11 bg-forest px-5 text-primary-foreground hover:bg-forest/90">
          <Save className="size-4" />
          {isPending ? "Creating draft..." : "Create private draft"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { cloneElement, useEffect, useState, useTransition } from "react";
import type { MouseEvent, ReactElement } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";

import { submitApplication, checkApplicationEligibility } from "./actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authPathForRedirect } from "@/lib/redirects";

type ApplicationModalProps = {
  listingId: string;
  trigger?: ReactElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>;
  initialOpen?: boolean;
};

export function ApplicationModal({ listingId, trigger, initialOpen = false }: ApplicationModalProps) {
  const [open, setOpen] = useState(initialOpen);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason: string | null } | null>(null);
  const defaultTrigger = <Button type="button" className="h-10 bg-forest text-primary-foreground hover:bg-forest/90">Apply now</Button>;

  useEffect(() => {
    if (!open) return;
    checkApplicationEligibility(listingId)
      .then(setEligibility)
      .catch(() => setEligibility({ eligible: false, reason: "unknown" }));
  }, [open, listingId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSuccess(false);
      setError(null);
      setEligibility(null);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.append("listingId", listingId);

    startTransition(async () => {
      const result = await submitApplication(formData);
      if (!result.success && result.error) {
        setError(result.error ?? "An unknown error occurred.");
      } else if (result.success) {
        setSuccess(true);
      }
    });
  };

  const triggerElement = cloneElement(trigger ?? defaultTrigger, {
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger?.props.onClick?.(event);
      if (!event.defaultPrevented) setOpen(true);
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerElement}

      <DialogContent className="overflow-hidden border-border bg-panel p-0 sm:max-w-[440px] sm:rounded-lg">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-normal text-ink">
              Apply for this property
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Share the details the landlord needs to review your application.
            </DialogDescription>
          </DialogHeader>
        </div>

        {!eligibility ? (
          <div className="flex min-h-[260px] items-center justify-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-forest" />
          </div>
        ) : eligibility.reason === "unauthenticated" ? (
          <div className="bg-warm-surface p-8 text-center">
            <h3 className="mb-3 text-xl font-semibold text-ink">Sign in required</h3>
            <p className="mb-6 text-muted-foreground">You need a renter account before applying.</p>
            <div className="flex justify-center gap-3">
              <Button render={<Link href={authPathForRedirect(`/listing/${listingId}?intent=apply`)} />} className="bg-forest text-primary-foreground hover:bg-forest/90">
                Sign in
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : !eligibility.eligible ? (
          <div className="flex min-h-[260px] flex-col justify-center bg-warm-surface p-8 text-center">
            <h3 className="mb-3 text-xl font-semibold text-ink">Cannot apply</h3>
            <p className="mb-6 text-muted-foreground">
              {eligibility.reason === "not_renter" && "You need a renter account to apply for a property."}
              {eligibility.reason === "cap_reached" && "You have reached the maximum of 5 active applications."}
              {eligibility.reason === "already_applied" && "You already have an active application for this property."}
              {eligibility.reason === "unknown" && "Eligibility could not be checked. Please try again."}
            </p>
            {eligibility.reason === "cap_reached" || eligibility.reason === "already_applied" ? (
              <Button render={<Link href="/applications" />} className="w-full bg-forest text-primary-foreground hover:bg-forest/90">
                View applications
              </Button>
            ) : (
              <Button className="w-full bg-forest text-primary-foreground hover:bg-forest/90" onClick={() => setOpen(false)}>
                Close
              </Button>
            )}
          </div>
        ) : success ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-10 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-lg border border-forest/20 bg-accent text-forest">
              <Check className="size-7" />
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-ink">Application submitted</h3>
            <p className="mb-7 text-muted-foreground">
              Track the status from your applications workspace.
            </p>
            <Button className="h-11 bg-forest px-8 text-primary-foreground hover:bg-forest/90" onClick={() => setOpen(false)}>
              Continue
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
            {error ? (
              <div className="mb-6 rounded-md border border-status-error-border bg-status-error-surface p-4 text-sm font-medium text-status-error-text">
                {error}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-semibold">Full legal name</Label>
                <Input id="fullName" name="fullName" required className="h-11 bg-warm-surface" placeholder="Jane Doe" />
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="income" className="text-sm font-semibold">Monthly income (ZAR)</Label>
                  <Input id="income" type="number" min="0" name="income" required className="h-11 bg-warm-surface" placeholder="25000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentStatus" className="text-sm font-semibold">Employment status</Label>
                  <Select name="employmentStatus" required defaultValue="employed">
                    <SelectTrigger className="h-11 w-full bg-warm-surface">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self-employed">Self-employed</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="unemployed">Unemployed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="moveInDate" className="text-sm font-semibold">Move-in date</Label>
                  <Input id="moveInDate" type="date" name="moveInDate" required className="h-11 bg-warm-surface" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="householdSize" className="text-sm font-semibold">Household size</Label>
                  <Input id="householdSize" type="number" min="1" max="10" name="householdSize" required className="h-11 bg-warm-surface" placeholder="2" />
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-ink">Required documents</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Upload your ID and latest payslip.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idDocument" className="text-sm font-semibold">Government ID</Label>
                  <Input id="idDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" name="idDocument" required className="h-12 cursor-pointer bg-warm-surface file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-forest" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payslipDocument" className="text-sm font-semibold">Latest payslip</Label>
                  <Input id="payslipDocument" type="file" accept=".pdf,.jpg,.jpeg,.png" name="payslipDocument" required className="h-12 cursor-pointer bg-warm-surface file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-forest" />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button type="submit" disabled={isPending} className="h-12 w-full bg-forest text-base font-medium text-primary-foreground hover:bg-forest/90">
                {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isPending ? "Submitting..." : "Submit application"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Your documents are only visible to the landlord reviewing this application.
              </p>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState } from "react";
import { CheckCircle2, Phone, ShieldAlert } from "lucide-react";

import { updateProfileAction } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MotionFeedback, PendingGlyph } from "@/lib/motion/primitives";

type ProfileFormProps = {
  currentPhone: string | null;
  phoneVerified: boolean;
};

const initialState = {
  success: false,
  message: "",
};

export function ProfileForm({ currentPhone, phoneVerified }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium text-ink">
          Phone number
        </Label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Phone className="size-4 text-muted-foreground" />
          </div>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+27 00 000 0000"
            defaultValue={currentPhone || ""}
            required
            className="h-11 rounded-md bg-warm-surface pl-10 focus-visible:border-ring focus-visible:ring-ring/30"
          />
          {currentPhone ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              {phoneVerified ? (
                <CheckCircle2 className="size-5 text-forest" aria-label="Verified" />
              ) : (
                <ShieldAlert className="size-5 text-amber-600" aria-label="Unverified" />
              )}
            </div>
          ) : null}
        </div>
        {phoneVerified ? (
          <p className="text-xs font-medium text-forest">Your phone number is verified.</p>
        ) : currentPhone ? (
          <p className="text-xs text-amber-700">Verification happens during applications.</p>
        ) : null}
      </div>

      {state.message ? (
        <MotionFeedback state={state.success ? "success" : "error"} className={`rounded-md border p-3 text-sm ${state.success ? "border-forest/20 bg-accent text-forest" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
          {state.message}
        </MotionFeedback>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-11 w-full bg-forest px-5 text-primary-foreground hover:bg-forest/90 sm:w-auto"
      >
        {isPending ? <PendingGlyph label="Saving profile" /> : null}
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileReviewAction } from "@/features/profile/actions";

export function ReviewEditor({ entitlementId }: { entitlementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-4 grid gap-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveProfileReviewAction({
            entitlementId,
            overall: Number(data.get("overall")),
            communication: null,
            honesty: null,
            professionalism: null,
            propertyAccuracy: null,
            viewingExperience: null,
            responsiveness: null,
            body: String(data.get("body") ?? ""),
            submit: data.get("intent") === "submit",
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            data.get("intent") === "submit"
              ? "Review submitted"
              : "Draft saved",
          );
          router.refresh();
        });
      }}
    >
      <label className="grid gap-2 text-sm font-semibold text-ink">
        Overall rating
        <select
          name="overall"
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} star{rating === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <Textarea
        name="body"
        maxLength={3000}
        placeholder="Share feedback from this verified interaction."
        className="min-h-24"
      />
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          <Star className="size-4" />
          Submit review
        </Button>
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="outline"
          disabled={pending}
        >
          Save draft
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { createBlogDraft, deleteBlogPost } from "../actions";

export function CreateBlogPostButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await createBlogDraft();
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Draft created");
        router.push(`/admin/blog/${result.data.id}/edit`);
      })}
    >
      <FilePlus2 className="size-4" />
      {pending ? "Creating…" : "New post"}
    </Button>
  );
}

export function DeleteBlogPostButton({ postId, compact = false }: { postId: string; compact?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return <Button type="button" size={compact ? "sm" : "default"} variant="destructive" onClick={() => setConfirming(true)}><Trash2 className="size-4" />Delete</Button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-status-error-surface px-3 py-2 text-sm text-status-error-text">
      <span>This permanently deletes the draft.</span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await deleteBlogPost(postId);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success("Blog post deleted");
          router.push("/admin/blog");
          router.refresh();
        })}
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  );
}

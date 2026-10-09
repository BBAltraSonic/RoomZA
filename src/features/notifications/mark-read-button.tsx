"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markNotificationRead } from "./inbox-actions";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
    const result = await markNotificationRead(id);
    if (!result.success) toast.error(result.error);
  })}>{pending ? "Marking as read…" : "Mark as read"}</Button>;
}

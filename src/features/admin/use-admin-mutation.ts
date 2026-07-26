"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type MutationResult = {
  success: boolean;
  error?: string;
};

export function useAdminMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(work: () => Promise<MutationResult>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        toast.error(result.error ?? "The action failed.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return { pending, run };
}

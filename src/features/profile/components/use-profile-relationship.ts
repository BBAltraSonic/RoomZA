"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setProfileRelationshipAction } from "@/features/profile/actions";

export function useProfileRelationship() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function change(
    input: Parameters<typeof setProfileRelationshipAction>[0],
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await setProfileRelationshipAction(input);
        if (!mounted.current) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        onSuccess?.();
        toast.success(successMessage);
        router.refresh();
      } catch {
        if (mounted.current) setError("The relationship change could not be confirmed. Try again to check.");
      } finally {
        busy.current = false;
      }
    });
  }

  return { change, pending, error };
}

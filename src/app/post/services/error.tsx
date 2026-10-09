"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ServicesWorkspaceError({
  retry,
}: {
  retry: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <h1 className="text-2xl font-semibold">Could not load your services</h1>
      <p role="alert">
        Try again to check your saved drafts. Changes can only be saved when the
        service workspace is available.
      </p>
      <Button onClick={retry}>Try again</Button>
      <Link
        href="/services"
        className="inline-flex min-h-11 items-center text-forest underline"
      >
        Browse services
      </Link>
    </main>
  );
}

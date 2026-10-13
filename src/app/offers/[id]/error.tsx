"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function OfferError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl space-y-5 px-5 py-10"><h1 className="text-2xl font-semibold">Could not load this offer</h1><p role="alert" className="text-status-error-text">Please try again to check its current availability.</p><Button className="min-h-11" onClick={reset}>Try again</Button><Link prefetch={false} href="/" className="flex min-h-11 items-center text-forest underline">Return to Pinpoint</Link></main>;
}


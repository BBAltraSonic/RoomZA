"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function OffersError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-4xl space-y-5 px-5 py-10"><h1 className="text-2xl font-semibold">Could not load Shopping Offers</h1><p role="alert" className="text-status-error-text">Try again or choose another location.</p><Button className="min-h-11" onClick={reset}>Try again</Button><Link href="/offers" prefetch={false} className="flex min-h-11 items-center text-forest underline">Choose another location</Link></main>;
}

"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ConfirmedError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 py-8"><h1 className="text-xl font-semibold">Could not load confirmed offers</h1><p className="text-sm text-muted-foreground">Check your reviewer access or open the first page again.</p><Button onClick={reset} variant="outline" className="min-h-11">Try again</Button><Link href="/admin/offers/confirmed" prefetch={false} className="flex min-h-11 items-center text-forest underline">First confirmed offers</Link></div>;
}

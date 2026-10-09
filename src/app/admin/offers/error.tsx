"use client";
import { Button } from "@/components/ui/button";
export default function OfferReviewError({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4 py-8"><h1 className="text-xl font-semibold">Could not load submitted offers</h1><p className="text-sm text-muted-foreground">Check your reviewer access and try again.</p><Button onClick={reset} variant="outline">Try again</Button></div>; }

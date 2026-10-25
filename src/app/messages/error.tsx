"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MessagesError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-2xl font-semibold text-ink">Messages could not be loaded</h1>
      <p role="alert" className="text-muted-foreground">Your conversation history is kept. Try loading it again.</p>
      <Button onClick={retry} className="min-h-11 w-fit">Try again</Button>
      <Link href="/messages" className="w-fit py-2 text-forest underline">Back to messages</Link>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export function TrustShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 pb-24 pt-6 text-foreground sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-border pb-4">
          <Link href="/trust" className="inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-ink outline-none hover:text-forest focus-visible:ring-2 focus-visible:ring-ring">
            <ShieldCheck className="size-5 text-forest" /> Pinpoint Trust &amp; Safety
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" /> Return to map
          </Link>
        </header>
        <div className={aside ? "grid gap-10 py-10 lg:grid-cols-[15rem_minmax(0,1fr)]" : "py-10"}>
          {aside ? <aside className="lg:sticky lg:top-6 lg:self-start">{aside}</aside> : null}
          {children}
        </div>
      </div>
    </main>
  );
}

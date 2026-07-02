import { MailCheck } from "lucide-react";

export default function VerifyEmailLoading() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-2)]">
          <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-forest text-primary-foreground">
            <MailCheck className="size-5" />
          </div>
          <div className="h-3 w-28 rounded bg-warm-surface" />
          <div className="mt-3 h-8 w-48 rounded bg-warm-surface" />
          <div className="mt-4 h-4 w-full rounded bg-warm-surface" />
          <div className="mt-2 h-4 w-4/5 rounded bg-warm-surface" />
        </div>
      </div>
    </main>
  );
}

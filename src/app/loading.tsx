import { LoadingSkeleton } from "@/components/ui/route-state";

export default function AppLoading() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl items-center">
        <LoadingSkeleton title="Loading RoomZA" rows={5} />
      </div>
    </main>
  );
}

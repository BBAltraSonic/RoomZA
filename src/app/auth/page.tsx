import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";

import { AuthForm } from "@/app/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in or create your RoomZA account.",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[#f5f3ee] px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <Link
          className="mb-8 inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted"
          href="/"
        >
          <Home className="size-4" />
          RoomZA
        </Link>
        <div className="mb-6">
          <p className="text-sm font-medium text-[#2d5b52]">Account access</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Sign in or create your account</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Email/password auth is connected to Supabase. Phone verification and role selection come next.
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}

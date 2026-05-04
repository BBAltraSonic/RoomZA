import { redirect } from "next/navigation";

import { getRoleHome, isRole, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (!profile) {
    const { data: createdProfile } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    return { user, profile: createdProfile };
  }

  return { user, profile };
}

export async function requireUser() {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect("/auth");
  }

  return session as Awaited<ReturnType<typeof getSessionProfile>> & {
    user: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>["user"]>;
  };
}

export async function requireRole(requiredRole: Role) {
  const session = await requireUser();

  if (!isRole(session.profile?.role)) {
    redirect("/onboarding");
  }

  if (session.profile.role !== requiredRole) {
    redirect(getRoleHome(session.profile.role));
  }

  return session as typeof session & {
    profile: NonNullable<typeof session.profile> & { role: Role };
  };
}

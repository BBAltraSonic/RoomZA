"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getRoleHome, isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function chooseRoleAction(formData: FormData) {
  const requestedRole = formData.get("role");

  if (!isRole(requestedRole)) {
    redirect("/onboarding?error=role");
  }

  const { user } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      role: requestedRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    redirect("/onboarding?error=save");
  }

  redirect(getRoleHome(requestedRole));
}

"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMarketplaceRedirect } from "@/lib/redirects";

export async function chooseRoleAction(formData: FormData) {
  const destination = getMarketplaceRedirect(formData.get("redirect"));
  await requireUser({ redirectTo: destination });
  redirect(destination);
}

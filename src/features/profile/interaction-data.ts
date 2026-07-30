import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

export type InteractionProfile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  presence_status: string | null;
  phone_verified: boolean;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  role: null;
};

type InteractionAccountRow = Omit<
  InteractionProfile,
  "full_name" | "avatar_url" | "role"
>;

type InteractionIdentityRow = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
};

export async function getInteractionProfileMap(
  ids: Array<string | null | undefined>,
) {
  const profileIds = [
    ...new Set(ids.filter((id): id is string => Boolean(id))),
  ];
  if (!profileIds.length) return new Map<string, InteractionProfile>();
  const admin = createUntypedClient();
  const [{ data: accounts }, { data: identities }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id,email,phone,phone_verified,email_verified_at,presence_status,created_at,updated_at",
      )
      .in("id", profileIds),
    admin
      .from("public_profiles")
      .select("profile_id,display_name,avatar_url")
      .in("profile_id", profileIds),
  ]);
  const identityById = new Map(
    ((identities ?? []) as InteractionIdentityRow[]).map((row) => [
      row.profile_id,
      row,
    ]),
  );
  return new Map<string, InteractionProfile>(
    ((accounts ?? []) as InteractionAccountRow[]).map((account) => {
      const identity = identityById.get(account.id);
      return [
        account.id,
        {
          id: account.id,
          email: account.email,
          phone: account.phone,
          full_name: identity?.display_name ?? "Pinpoint member",
          avatar_url: identity?.avatar_url ?? null,
          presence_status: account.presence_status,
          phone_verified: account.phone_verified,
          email_verified_at: account.email_verified_at,
          created_at: account.created_at,
          updated_at: account.updated_at,
          role: null,
        },
      ];
    }),
  );
}

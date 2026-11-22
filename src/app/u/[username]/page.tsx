import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ProfileSignInRequired,
  PublicProfileView,
} from "@/features/profile/components/public-profile-view";
import { resolvePublicProfile } from "@/features/profile/data";
import { getSessionProfile } from "@/lib/auth";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const result = await resolvePublicProfile(username);
  if (result.status === "sign_in_required")
    return { title: "Sign in to view this profile", robots: { index: false, follow: false } };
  if (result.status !== "visible")
    return { title: "Profile not found", robots: { index: false, follow: false } };
  const { profile } = result;
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description:
      profile.bio?.slice(0, 160) ??
      `See ${profile.displayName}'s listings, verified checks and reviews on Pinpoint.`,
    robots: { index: profile.searchIndexed, follow: profile.searchIndexed },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const [result, session] = await Promise.all([
    resolvePublicProfile(username),
    getSessionProfile(),
  ]);
  if (result.status === "sign_in_required")
    return <ProfileSignInRequired username={username.toLowerCase()} />;
  if (result.status !== "visible") notFound();
  return <PublicProfileView profile={result.profile} signedIn={Boolean(session.user)} />;
}

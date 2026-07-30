import type { Metadata } from "next";

import { PageHeader } from "@/components/premium/primitives";
import { ProfileEditClient } from "@/features/profile/components/profile-edit-client";
import { getPrivateProfileData } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "Edit Profile",
  robots: { index: false, follow: false },
};

export default async function ProfileEditPage() {
  const profile = await getPrivateProfileData();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Identity"
        title="Edit profile"
        description="Public identity and private persona details are stored separately."
      />
      <ProfileEditClient initialProfile={profile} />
    </div>
  );
}

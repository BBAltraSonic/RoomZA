import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SettingsSectionView } from "@/features/profile/components/settings-section";
import {
  getProfileSettingsData,
  settingsSections,
  type SettingsSection,
} from "@/features/profile/settings-data";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  // Profile editing has one home; keep old links to the removed settings section working.
  if (section === "profile") redirect("/profile/edit");
  if (!settingsSections.includes(section as SettingsSection)) notFound();
  const data = await getProfileSettingsData();
  return (
    <SettingsSectionView section={section as SettingsSection} data={data} />
  );
}

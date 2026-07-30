import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  if (!settingsSections.includes(section as SettingsSection)) notFound();
  const data = await getProfileSettingsData();
  return (
    <SettingsSectionView section={section as SettingsSection} data={data} />
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";

import { SettingsDashboard } from "@/components/settings/settings-dashboard";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";
import { getSettingsView } from "@/lib/settings/settings-service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const session = await auth.api.getSession({ headers: await headers() });
  return <SettingsDashboard view={await getSettingsView(user.id, session?.session.id ?? null)} />;
}

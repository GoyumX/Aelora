import type { Metadata } from "next";

import { HelpSupportDashboard } from "@/components/support/help-support-dashboard";
import { requireUser } from "@/lib/auth/session";
import { getSupportView } from "@/lib/support/support-service";

export const metadata: Metadata = { title: "Help and support" };

export default async function HelpPage() {
  const user = await requireUser();
  return <HelpSupportDashboard view={await getSupportView(user.id)} />;
}

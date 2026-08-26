import type { Metadata } from "next";
import Link from "next/link";

import { AlertsDashboard } from "@/components/alerts/alerts-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { getPrimaryAlertsView } from "@/lib/alerts/alert-service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const user = await requireUser();
  const view = await getPrimaryAlertsView(user);
  if (!view) return <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Incident operations</p><h1 className="font-heading text-3xl font-semibold">No solar site available</h1><p className="text-muted-foreground">Configure a site and enroll a gateway before evaluating operational alerts.</p><Link className={buttonVariants()} href="/system-configuration">Open System Configuration</Link></main>;
  return <AlertsDashboard initialView={view} />;
}

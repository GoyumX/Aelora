import type { Metadata } from "next";
import Link from "next/link";

import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getReportsView } from "@/lib/reports/report-service";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!site) return <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Stable exports</p><h1 className="font-heading text-3xl font-semibold">No solar site available</h1><p className="text-muted-foreground">Configure a site before generating weekly or monthly reports.</p><Link className={buttonVariants()} href="/system-configuration">Open System Configuration</Link></main>;
  return <ReportsDashboard view={await getReportsView(user, site.id)} />;
}

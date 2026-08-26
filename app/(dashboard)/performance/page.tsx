import type { Metadata } from "next";
import Link from "next/link";

import { PerformanceDashboard } from "@/components/performance/performance-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPerformanceReport } from "@/lib/performance/performance-service";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query.range)) ? Number(query.range) : 30;
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to.getTime() - days * 86_400_000);
  const report = await getOwnedPerformanceReport(user.id, from, to);

  if (!report) return <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">System health</p><h1 className="font-heading text-3xl font-semibold">No solar site available</h1><p className="text-muted-foreground">Configure a site and its equipment before evaluating performance.</p><Link className={buttonVariants()} href="/system-configuration">Open System Configuration</Link></main>;
  return <PerformanceDashboard report={report} />;
}

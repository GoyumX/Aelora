import type { Metadata } from "next";
import Link from "next/link";

import { AiForecastDashboard } from "@/components/forecast/ai-forecast-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getLatestSiteForecast } from "@/lib/forecast/forecast-service";
import { getSiteForecastEvaluation } from "@/lib/forecast/verification-service";

export const metadata: Metadata = { title: "AI forecast" };

export default async function AiForecastPage() {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({
    where: {
      deletedAt: null,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!site) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl flex-col items-start justify-center gap-4 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Intelligence</p>
        <h1 className="font-heading text-3xl font-semibold">No solar site available</h1>
        <p className="text-muted-foreground">Configure a site and active solar arrays before generating an AI forecast.</p>
        <Link className={buttonVariants()} href="/system-configuration">Open System Configuration</Link>
      </main>
    );
  }

  const actor = { id: user.id, role: user.role };
  const [forecast, evaluation] = await Promise.all([
    getLatestSiteForecast(actor, site.id),
    getSiteForecastEvaluation(actor, site.id),
  ]);
  return <AiForecastDashboard autoRefresh evaluation={evaluation} forecast={forecast} now={new Date().toISOString()} siteId={site.id} />;
}

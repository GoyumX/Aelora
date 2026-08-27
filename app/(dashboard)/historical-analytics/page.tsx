import type { Metadata } from "next";

import { HistoricalAnalytics } from "@/components/analytics/historical-analytics";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { historyGrains } from "@/lib/telemetry/history";
import { getHistoricalTelemetry } from "@/lib/telemetry/history-service";
import { localDayRange } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Historical analytics" };

export default async function HistoricalAnalyticsPage({ searchParams }: { searchParams: Promise<{ date?: string; range?: string; grain?: string }> }) {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, timezone: true } });
  if (!site) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-heading text-3xl font-semibold">No site available</h1></main>;
  const query = await searchParams;
  let selectedRange: { from: Date; to: Date } | null = null;
  if (query.date) {
    try { selectedRange = localDayRange(query.date, site.timezone); } catch { selectedRange = null; }
  }
  const days = [7, 30, 90].includes(Number(query.range)) ? Number(query.range) : 30;
  const grain = selectedRange ? "day" : historyGrains.includes(query.grain as (typeof historyGrains)[number]) ? query.grain as (typeof historyGrains)[number] : "day";
  const to = selectedRange?.to ?? new Date();
  if (!selectedRange) {
    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() + 1);
  }
  const from = selectedRange?.from ?? new Date(to.getTime() - days * 86_400_000);
  const history = await getHistoricalTelemetry(site, from, to, grain);
  return <HistoricalAnalytics history={history} />;
}

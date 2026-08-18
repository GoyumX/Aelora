import { HistoricalAnalytics } from "@/components/analytics/historical-analytics";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { historyGrains } from "@/lib/telemetry/history";
import { getHistoricalTelemetry } from "@/lib/telemetry/history-service";

export default async function HistoricalAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; grain?: string }> }) {
  const user = await requireUser();
  const site = await db.solarSite.findFirst({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, timezone: true } });
  if (!site) return <main className="mx-auto max-w-3xl p-8"><h1 className="font-heading text-3xl font-semibold">No site available</h1></main>;
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query.range)) ? Number(query.range) : 30;
  const grain = historyGrains.includes(query.grain as (typeof historyGrains)[number]) ? query.grain as (typeof historyGrains)[number] : "day";
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to.getTime() - days * 86_400_000);
  const history = await getHistoricalTelemetry(site, from, to, grain);
  return <HistoricalAnalytics history={history} />;
}

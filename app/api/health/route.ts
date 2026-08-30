import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    return Response.json(
      {
        status: "ok",
        checks: { database: "ok" },
        version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
        observedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        checks: { database: "unavailable" },
        observedAt: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}

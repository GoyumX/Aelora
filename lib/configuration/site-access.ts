import "server-only";

import type { UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

export async function findConfigurableSite(actor: { id: string; role: UserRole }, siteId: string) {
  return db.solarSite.findFirst({
    where: { id: siteId, deletedAt: null, ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }) },
    select: { id: true },
  });
}

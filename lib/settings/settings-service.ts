import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { settingsUpdateSchema, type MeasurementSystemValue, type SettingsUpdate, type ThemePreferenceValue } from "@/lib/settings/settings";

export class SettingsDomainError extends Error {
  constructor(public code: "USER_NOT_FOUND" | "DEFAULT_SITE_NOT_FOUND" | "USERNAME_TAKEN") {
    super(code);
  }
}

export type SettingsView = {
  profile: { id: string; name: string; username: string | null; email: string; image: string | null; role: "USER" | "ADMIN" };
  preferences: {
    theme: ThemePreferenceValue;
    timezone: string;
    measurementSystem: MeasurementSystemValue;
    emailNotifications: boolean;
    defaultSiteId: string | null;
  };
  sites: Array<{ id: string; name: string; timezone: string; status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" }>;
  sessions: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    isCurrent: boolean;
  }>;
};

const userViewSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  image: true,
  role: true,
  preference: { select: { theme: true, timezone: true, measurementSystem: true, emailNotifications: true, defaultSiteId: true } },
  ownedSites: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, timezone: true, status: true },
  },
  sessions: {
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
  },
} as const;

export async function getSettingsView(userId: string, currentSessionId: string | null, now = new Date()): Promise<SettingsView> {
  const user = await db.user.findUnique({ where: { id: userId }, select: userViewSelect });
  if (!user) throw new SettingsDomainError("USER_NOT_FOUND");
  const sites = user.ownedSites;
  const preference = user.preference;
  return {
    profile: { id: user.id, name: user.name, username: user.username, email: user.email, image: user.image, role: user.role },
    preferences: {
      theme: preference?.theme ?? "SYSTEM",
      timezone: preference?.timezone ?? sites[0]?.timezone ?? "Asia/Colombo",
      measurementSystem: preference?.measurementSystem ?? "METRIC",
      emailNotifications: preference?.emailNotifications ?? true,
      defaultSiteId: preference?.defaultSiteId ?? sites[0]?.id ?? null,
    },
    sites,
    sessions: user.sessions.filter((session) => session.expiresAt > now).map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isCurrent: session.id === currentSessionId,
    })),
  };
}

export async function updateUserSettings(userId: string, input: SettingsUpdate) {
  const settings = settingsUpdateSchema.parse(input);
  if (settings.username) {
    const usernameOwner = await db.user.findFirst({ where: { username: settings.username, NOT: { id: userId } }, select: { id: true } });
    if (usernameOwner) throw new SettingsDomainError("USERNAME_TAKEN");
  }
  if (settings.defaultSiteId) {
    const site = await db.solarSite.findFirst({ where: { id: settings.defaultSiteId, ownerId: userId, deletedAt: null }, select: { id: true } });
    if (!site) throw new SettingsDomainError("DEFAULT_SITE_NOT_FOUND");
  }

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const profile = await tx.user.update({
        where: { id: userId },
        data: { name: settings.name, username: settings.username },
        select: { id: true, name: true, username: true, email: true, image: true, role: true },
      });
      const preference = await tx.userPreference.upsert({
        where: { userId },
        create: { userId, theme: settings.theme, timezone: settings.timezone, measurementSystem: settings.measurementSystem, emailNotifications: settings.emailNotifications, defaultSiteId: settings.defaultSiteId },
        update: { theme: settings.theme, timezone: settings.timezone, measurementSystem: settings.measurementSystem, emailNotifications: settings.emailNotifications, defaultSiteId: settings.defaultSiteId },
        select: { theme: true, timezone: true, measurementSystem: true, emailNotifications: true, defaultSiteId: true },
      });
      return { profile, preferences: preference };
    });
  } catch (error) {
    const conflict = error as { code?: unknown; meta?: { target?: unknown } };
    const target = Array.isArray(conflict.meta?.target) ? conflict.meta.target : [];
    if (conflict.code === "P2002" && target.includes("username")) throw new SettingsDomainError("USERNAME_TAKEN");
    throw error;
  }
}

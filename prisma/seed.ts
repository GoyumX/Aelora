import "dotenv/config";

import { UserRole } from "@prisma/client";

import { auth } from "../lib/auth-instance";
import { db } from "../lib/db";
import { createTelemetrySnapshot } from "../lib/telemetry/simulator";

function requiredSecret(name: "SEED_ADMIN_PASSWORD" | "SEED_USER_PASSWORD") {
  const value = process.env[name];
  if (!value || value.length < 10) {
    throw new Error(`${name} must be set to a local-only password of at least 10 characters.`);
  }
  return value;
}

async function ensureUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}) {
  let user = await db.user.findUnique({ where: { email: input.email } });

  if (!user) {
    await auth.api.signUpEmail({
      body: { email: input.email, name: input.name, password: input.password },
    });
    user = await db.user.findUniqueOrThrow({ where: { email: input.email } });
  }

  return db.user.update({
    where: { id: user.id },
    data: {
      role: input.role,
      status: "ACTIVE",
      preference: {
        upsert: {
          create: {},
          update: {},
        },
      },
    },
  });
}

async function seedTelemetry(site: { id: string; name: string; timezone: string; mode: "SIMULATED" | "HARDWARE"; status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" }, installedCapacityW: number) {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const readings = Array.from({ length: 180 * 24 }, (_, index) => {
    const observedAt = new Date(end.getTime() - (180 * 24 - index) * 3_600_000);
    const snapshot = createTelemetrySnapshot({ ...site, installedCapacityW }, observedAt);
    return {
      siteId: site.id, observedAt, source: snapshot.source, quality: snapshot.quality,
      pvPowerW: snapshot.pvPowerW, pvEnergyTodayWh: snapshot.pvEnergyTodayWh, loadPowerW: snapshot.loadPowerW,
      gridPowerW: snapshot.gridPowerW, batteryPowerW: snapshot.batteryPowerW, batterySocPct: snapshot.batterySocPct,
      dcVoltageV: snapshot.dcVoltageV, dcCurrentA: snapshot.dcCurrentA, acVoltageV: snapshot.acVoltageV,
      acCurrentA: snapshot.acCurrentA, gridVoltageV: snapshot.gridVoltageV, frequencyHz: snapshot.frequencyHz,
      inverterTemperatureC: snapshot.inverterTemperatureC, panelTemperatureC: snapshot.panelTemperatureC,
      irradianceWm2: snapshot.irradianceWm2, deviceStatus: snapshot.deviceStatus,
    };
  });
  for (let index = 0; index < readings.length; index += 500) {
    await db.telemetryReading.createMany({ data: readings.slice(index, index + 500), skipDuplicates: true });
  }
}

async function main() {
  const admin = await ensureUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@aelora.local",
    name: "Aelora Admin",
    password: requiredSecret("SEED_ADMIN_PASSWORD"),
    role: "ADMIN",
  });

  const user = await ensureUser({
    email: process.env.SEED_USER_EMAIL ?? "user@aelora.local",
    name: "Aelora User",
    password: requiredSecret("SEED_USER_PASSWORD"),
    role: "USER",
  });

  const userSite = await db.solarSite.upsert({
    where: { slug: "colombo-home" },
    create: {
      ownerId: user.id,
      name: "Colombo Home",
      slug: "colombo-home",
      latitude: 6.9271,
      longitude: 79.8612,
    },
    update: { ownerId: user.id },
  });

  const adminSite = await db.solarSite.upsert({
    where: { slug: "admin-demo-site" },
    create: {
      ownerId: admin.id,
      name: "Admin Demo Site",
      slug: "admin-demo-site",
      latitude: 6.9271,
      longitude: 79.8612,
    },
    update: { ownerId: admin.id },
  });

  await db.solarArray.upsert({
    where: { siteId_name: { siteId: userSite.id, name: "East roof" } },
    create: { siteId: userSite.id, name: "East roof", manufacturer: "Aelora Demo", model: "Mono 440", panelCount: 7, ratedPowerW: 440, tiltDeg: 18, azimuthDeg: 90, temperatureCoefficientPctC: -0.35 },
    update: { manufacturer: "Aelora Demo", model: "Mono 440", panelCount: 7, ratedPowerW: 440, tiltDeg: 18, azimuthDeg: 90, status: "ACTIVE", archivedAt: null },
  });
  await db.solarArray.upsert({
    where: { siteId_name: { siteId: userSite.id, name: "West roof" } },
    create: { siteId: userSite.id, name: "West roof", manufacturer: "Aelora Demo", model: "Mono 440", panelCount: 7, ratedPowerW: 440, tiltDeg: 18, azimuthDeg: 270, temperatureCoefficientPctC: -0.35 },
    update: { manufacturer: "Aelora Demo", model: "Mono 440", panelCount: 7, ratedPowerW: 440, tiltDeg: 18, azimuthDeg: 270, status: "ACTIVE", archivedAt: null },
  });
  await db.solarArray.upsert({
    where: { siteId_name: { siteId: adminSite.id, name: "Admin demo array" } },
    create: { siteId: adminSite.id, name: "Admin demo array", panelCount: 12, ratedPowerW: 450, tiltDeg: 15, azimuthDeg: 180 },
    update: { panelCount: 12, ratedPowerW: 450, tiltDeg: 15, azimuthDeg: 180, status: "ACTIVE", archivedAt: null },
  });

  const primaryInverter = await db.inverter.findFirst({ where: { siteId: userSite.id, archivedAt: null }, orderBy: { createdAt: "asc" } });
  const inverterData = { manufacturer: "Aelora Virtual", model: "Digital Twin 6K", serialAlias: "SIM-INV-01", acRatingW: 6000, efficiencyPct: 97.5, phase: 1, communicationAdapter: "SIMULATOR", pollingIntervalSec: 15 };
  if (primaryInverter) await db.inverter.update({ where: { id: primaryInverter.id }, data: inverterData });
  else await db.inverter.create({ data: { siteId: userSite.id, ...inverterData } });

  await db.battery.upsert({
    where: { siteId: userSite.id },
    create: { siteId: userSite.id, enabled: true, manufacturer: "Aelora Virtual", model: "Home Store 10", usableCapacityWh: 10000, maxChargePowerW: 3000, maxDischargePowerW: 3000, minSocPct: 10, maxSocPct: 95, roundTripEfficiencyPct: 92, reservePct: 20 },
    update: { enabled: true, manufacturer: "Aelora Virtual", model: "Home Store 10", usableCapacityWh: 10000, maxChargePowerW: 3000, maxDischargePowerW: 3000, minSocPct: 10, maxSocPct: 95, roundTripEfficiencyPct: 92, reservePct: 20, status: "ACTIVE" },
  });

  await seedTelemetry({ id: userSite.id, name: userSite.name, timezone: userSite.timezone, mode: userSite.mode, status: userSite.status }, 6160);
  await seedTelemetry({ id: adminSite.id, name: adminSite.name, timezone: adminSite.timezone, mode: adminSite.mode, status: adminSite.status }, 5400);

  console.info("Aelora development users and simulated sites are ready.");
}

main()
  .catch((error) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

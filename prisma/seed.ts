import "dotenv/config";

import { UserRole } from "@prisma/client";

import { auth } from "../lib/auth-instance";
import { db } from "../lib/db";

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

  await db.solarSite.upsert({
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

  await db.solarSite.upsert({
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

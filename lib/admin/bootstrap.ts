import { z } from "zod";

const placeholderFragments = ["replace-with", "change-me", "changeme", "example-password"];

const bootstrapAdminSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email(),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(2).max(80),
  BOOTSTRAP_ADMIN_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .default("aelora-admin"),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(16).max(128),
});

export type BootstrapAdminConfig = {
  email: string;
  name: string;
  username: string;
  password: string;
};

type BootstrapAdminDependencies = {
  findUnique: (args: { where: { email: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  update: (args: {
    where: { id: string };
    data: {
      name: string;
      username: string;
      role: "ADMIN";
      status: "ACTIVE";
      deletedAt: null;
      preference: { upsert: { create: Record<string, never>; update: Record<string, never> } };
    };
  }) => Promise<unknown>;
  signUpEmail: (body: { email: string; name: string; password: string }) => Promise<unknown>;
};

export function parseBootstrapAdminEnv(env: Record<string, string | undefined>): BootstrapAdminConfig {
  const parsed = bootstrapAdminSchema.parse(env);
  const normalizedPassword = parsed.BOOTSTRAP_ADMIN_PASSWORD.toLowerCase();
  if (placeholderFragments.some((fragment) => normalizedPassword.includes(fragment))) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD contains a placeholder and must be replaced.");
  }

  return {
    email: parsed.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
    name: parsed.BOOTSTRAP_ADMIN_NAME,
    username: parsed.BOOTSTRAP_ADMIN_USERNAME,
    password: parsed.BOOTSTRAP_ADMIN_PASSWORD,
  };
}

export async function bootstrapAdmin(
  config: BootstrapAdminConfig,
  dependencies: BootstrapAdminDependencies,
) {
  let user = await dependencies.findUnique({
    where: { email: config.email },
    select: { id: true },
  });
  const created = user === null;

  if (!user) {
    await dependencies.signUpEmail({
      email: config.email,
      name: config.name,
      password: config.password,
    });
    user = await dependencies.findUnique({
      where: { email: config.email },
      select: { id: true },
    });
  }

  if (!user) {
    throw new Error("The admin account could not be loaded after registration.");
  }

  await dependencies.update({
    where: { id: user.id },
    data: {
      name: config.name,
      username: config.username,
      role: "ADMIN",
      status: "ACTIVE",
      deletedAt: null,
      preference: { upsert: { create: {}, update: {} } },
    },
  });

  return { created, email: config.email };
}

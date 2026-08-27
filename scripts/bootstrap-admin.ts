import "dotenv/config";

import { auth } from "../lib/auth-instance";
import { bootstrapAdmin, parseBootstrapAdminEnv } from "../lib/admin/bootstrap";
import { db } from "../lib/db";

async function main() {
  const config = parseBootstrapAdminEnv(process.env);
  const result = await bootstrapAdmin(config, {
    findUnique: (args) => db.user.findUnique(args),
    update: (args) => db.user.update(args),
    signUpEmail: (body) => auth.api.signUpEmail({ body }),
  });

  console.info(
    result.created
      ? `Created and activated production administrator ${result.email}.`
      : `Verified and activated existing administrator ${result.email}.`,
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown bootstrap failure";
    console.error(`Administrator bootstrap failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

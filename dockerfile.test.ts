import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("web container dependency stage", () => {
  it("copies the Prisma schema before npm ci runs the postinstall generator", () => {
    const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
    const dependenciesStage = dockerfile.slice(
      dockerfile.indexOf("FROM base AS dependencies"),
      dockerfile.indexOf("FROM base AS builder"),
    );

    const schemaCopy = dependenciesStage.indexOf(
      "COPY prisma/schema.prisma ./prisma/schema.prisma",
    );
    const dependencyInstall = dependenciesStage.indexOf("RUN npm ci");

    expect(schemaCopy).toBeGreaterThanOrEqual(0);
    expect(dependencyInstall).toBeGreaterThan(schemaCopy);
  });
});

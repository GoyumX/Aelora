import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("database seed runtime boundary", () => {
  it("uses the framework-neutral auth instance instead of the Next.js server-only entrypoint", () => {
    const seedSource = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf8");

    expect(seedSource).toContain('from "../lib/auth-instance"');
    expect(seedSource).not.toContain('from "../lib/auth"');
  });
});

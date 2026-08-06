import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Aelora color system", () => {
  it("uses blue foundations while reserving green for energy status", () => {
    const globalStyles = source("app/globals.css");

    expect(globalStyles).toContain("--background: oklch(0.985 0.008 240)");
    expect(globalStyles).toContain("--primary: oklch(0.48 0.17 255)");
    expect(globalStyles).toContain("--energy: oklch(0.67 0.16 151)");
  });

  it("removes the previous dark-green landing and authentication surfaces", () => {
    const publicSurfaces = `${source("app/page.tsx")}\n${source("app/(auth)/layout.tsx")}`;

    expect(publicSurfaces).not.toContain("#102d2e");
    expect(publicSurfaces).not.toContain("#173738");
    expect(publicSurfaces).not.toContain("rgba(8,38,39");
  });
});

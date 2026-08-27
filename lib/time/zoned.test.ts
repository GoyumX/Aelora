import { describe, expect, it } from "vitest";

import { localDayRange, startOfLocalDay } from "@/lib/time/zoned";

describe("startOfLocalDay", () => {
  it("returns midnight for the site's timezone, including half-hour offsets", () => {
    expect(startOfLocalDay(
      new Date("2026-08-25T10:15:00.000Z"),
      "Asia/Colombo",
    ).toISOString()).toBe("2026-08-24T18:30:00.000Z");
  });

  it("uses the local calendar day rather than the UTC calendar day", () => {
    expect(startOfLocalDay(
      new Date("2026-08-25T01:00:00.000Z"),
      "America/New_York",
    ).toISOString()).toBe("2026-08-24T04:00:00.000Z");
  });
});

describe("localDayRange", () => {
  it("returns the exact site-local day for a selected calendar date", () => {
    const range = localDayRange("2026-08-07", "Asia/Colombo");

    expect(range.from.toISOString()).toBe("2026-08-06T18:30:00.000Z");
    expect(range.to.toISOString()).toBe("2026-08-07T18:30:00.000Z");
  });
});

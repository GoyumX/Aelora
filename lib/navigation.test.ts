import { describe, expect, it } from "vitest";

import {
  appNavigation,
  findNavigationItem,
  getNavigationItems,
} from "@/lib/navigation";

describe("appNavigation", () => {
  it("contains every requested user-facing product area", () => {
    const labels = getNavigationItems(appNavigation).map((item) => item.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Live Monitoring",
        "AI Forecast",
        "Performance",
        "Historical Analytics",
        "Alerts",
        "Reports",
        "System Configuration",
        "Settings",
        "Help & Support",
      ]),
    );
  });

  it("uses a unique path for every navigation destination", () => {
    const paths = getNavigationItems(appNavigation).map((item) => item.href);

    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("findNavigationItem", () => {
  it("selects the most specific matching route", () => {
    expect(
      findNavigationItem(
        "/system-configuration/solar-panels",
        appNavigation,
      )?.label,
    ).toBe("Solar Panels");
  });

  it("returns undefined for a public route", () => {
    expect(findNavigationItem("/", appNavigation)).toBeUndefined();
  });
});


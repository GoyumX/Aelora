import { describe, expect, it } from "vitest";

import {
  appNavigation,
  findNavigationItem,
  getNavigationForRole,
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

describe("role-aware navigation", () => {
  it("shows administration only to administrators", () => {
    const userLabels = getNavigationItems(getNavigationForRole("USER")).map(
      (item) => item.label,
    );
    const adminLabels = getNavigationItems(getNavigationForRole("ADMIN")).map(
      (item) => item.label,
    );

    expect(userLabels).not.toContain("Admin Console");
    expect(adminLabels).toContain("Admin Console");
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

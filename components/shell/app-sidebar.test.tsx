import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/shell/app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("AppSidebar", () => {
  it("exposes labelled primary navigation and the current page", () => {
    render(<AppSidebar />);

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("provides access to configuration, settings, and help", () => {
    render(<AppSidebar />);

    expect(
      screen.getByRole("link", { name: "System Configuration" }),
    ).toHaveAttribute("href", "/system-configuration");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("link", { name: "Help & Support" }),
    ).toHaveAttribute("href", "/help");
  });
});


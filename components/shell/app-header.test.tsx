import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/shell/app-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AppHeader", () => {
  it("labels the site selector and icon-only controls", () => {
    render(<AppHeader siteName="Kandy Array" user={{ name: "Nimal Silva", email: "nimal@example.com" }} />);

    expect(
      screen.getByRole("button", { name: "Select solar site" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View notifications" }),
    ).toHaveAttribute("href", "/alerts");
    expect(
      screen.getByRole("button", { name: "Change color theme" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Nimal Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kandy Array").length).toBeGreaterThan(0);
  });

  it("opens the solar-site and user menus without a missing group context error", async () => {
    const user = userEvent.setup();
    render(<AppHeader siteName="Colombo Home" user={{ name: "Aelora User", email: "user@aelora.local" }} />);

    await user.click(screen.getByRole("button", { name: "Select solar site" }));
    expect(await screen.findByText("Solar sites")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Colombo Home" })).toBeVisible();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    expect(await screen.findByText("user@aelora.local")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Profile settings" })).toHaveAttribute("href", "/settings#profile");
  });
});

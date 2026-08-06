import { render, screen } from "@testing-library/react";
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
      screen.getByRole("button", { name: "View notifications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change color theme" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open user menu" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Nimal Silva").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kandy Array").length).toBeGreaterThan(0);
  });
});

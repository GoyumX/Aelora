import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";

import { AppShell } from "@/components/shell/app-shell";

vi.mock("@/components/shell/app-header", () => ({
  AppHeader: () => <header>Header</header>,
}));

vi.mock("@/components/shell/app-sidebar", () => ({
  AppSidebar: () => <aside>Sidebar</aside>,
}));

describe("AppShell", () => {
  it("provides a skip link and main landmark", () => {
    render(<AppShell>Page content</AppShell>);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
  });
});

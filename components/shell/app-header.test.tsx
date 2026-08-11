import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppHeader } from "@/components/shell/app-header";

describe("AppHeader", () => {
  it("labels the site selector and icon-only controls", () => {
    render(<AppHeader />);

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
  });
});

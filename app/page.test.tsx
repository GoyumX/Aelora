import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("Aelora landing page", () => {
  it("introduces the product and exposes both account paths", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /turn sunlight into foresight/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start monitoring" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("explains monitoring, forecasting, and simulated data", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Live monitoring" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI forecasting" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start without hardware" })).toBeInTheDocument();
  });

  it("provides meaningful alternative text for the solar-home hero", () => {
    render(<HomePage />);

    expect(
      screen.getByAltText("Solar panels on a tropical Sri Lankan home at sunrise"),
    ).toBeInTheDocument();
  });
});

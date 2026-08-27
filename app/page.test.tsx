import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("Aelora landing page", () => {
  it("introduces the product and exposes both account paths", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /read the sun\. run the day\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your site" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(
      screen.getAllByRole("link", { name: "Sign in" }).every(
        (link) => link.getAttribute("href") === "/sign-in",
      ),
    ).toBe(true);
  });

  it("explains monitoring, forecasting, and simulated data", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Observe the system as it moves." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seven days, translated into decisions." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hardware can come later." })).toBeInTheDocument();
  });

  it("gives the energy curve an accessible description", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("img", { name: "Today’s generation and household demand curve" }),
    ).toBeInTheDocument();
  });
});

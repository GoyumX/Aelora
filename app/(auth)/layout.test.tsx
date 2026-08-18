import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthLayout from "@/app/(auth)/layout";

describe("AuthLayout", () => {
  it("shows the solar-intelligence artwork as decorative context", () => {
    const { container } = render(<AuthLayout>Authentication form</AuthLayout>);

    expect(screen.getByText("Authentication form")).toBeInTheDocument();
    expect(container.querySelector('img[src*="aelora-auth-energy"]')).toHaveAttribute(
      "alt",
      "",
    );
  });
});

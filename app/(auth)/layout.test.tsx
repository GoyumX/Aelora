import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthLayout from "@/app/(auth)/layout";

describe("AuthLayout", () => {
  it("frames authentication with live product context", () => {
    render(<AuthLayout>Authentication form</AuthLayout>);

    expect(screen.getByText("Authentication form")).toBeInTheDocument();
    expect(screen.getByText("Solar intelligence, without the noise.")).toBeInTheDocument();
    expect(screen.getByText("Colombo Home")).toBeInTheDocument();
    expect(screen.getByText(/4\.82/)).toBeInTheDocument();
  });
});

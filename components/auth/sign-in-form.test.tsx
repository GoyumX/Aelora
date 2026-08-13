import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInForm } from "@/components/auth/sign-in-form";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
  },
}));

const signInEmail = vi.mocked(authClient.signIn.email);

describe("SignInForm", () => {
  beforeEach(() => signInEmail.mockReset());

  it("provides labelled email and password controls", () => {
    render(<SignInForm />);

    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("does not send invalid credentials to the auth service", async () => {
    render(<SignInForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    await waitFor(() => expect(signInEmail).not.toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { authClient } from "@/lib/auth-client";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
  },
}));

const signUpEmail = vi.mocked(authClient.signUp.email);

describe("SignUpForm", () => {
  beforeEach(() => signUpEmail.mockReset());

  it("provides labelled account fields", () => {
    render(<SignUpForm />);

    expect(screen.getByRole("textbox", { name: "Full name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("rejects a weak password before contacting the auth service", async () => {
    render(<SignUpForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), { target: { value: "Solar User" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "solar@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() => expect(signUpEmail).not.toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent("at least 10 characters");
  });

  it("submits a valid account with the user dashboard destination", async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null } as never);
    render(<SignUpForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), { target: { value: "Solar User" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "SOLAR@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SolarPower42" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    await waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith({
        name: "Solar User",
        email: "solar@example.com",
        password: "SolarPower42",
        callbackURL: "/dashboard",
      }),
    );
  });

  it("does not expose the auth provider's registration error", async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { message: "database detail" } } as never);
    render(<SignUpForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), { target: { value: "Solar User" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "solar@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SolarPower42" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not create the account");
    expect(screen.queryByText("database detail")).not.toBeInTheDocument();
  });
});

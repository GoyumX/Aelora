"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/auth/validation";

export function SignUpForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const result = signUpSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your account details.");
      return;
    }

    setPending(true);
    const response = await authClient.signUp.email({
      ...result.data,
      callbackURL: "/dashboard",
    });

    if (response.error) {
      setError("We could not create the account. Try signing in if this email is already registered.");
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input autoComplete="name" id="name" name="name" placeholder="Your name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input autoComplete="email" id="email" name="email" placeholder="you@example.com" type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input autoComplete="new-password" id="password" name="password" type="password" />
        <p className="text-xs leading-5 text-muted-foreground">Use at least 10 characters with a letter and a number.</p>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

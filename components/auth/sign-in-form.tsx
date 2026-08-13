"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getSafeCallbackUrl, signInSchema } from "@/lib/auth/validation";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const result = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your sign-in details.");
      return;
    }

    setPending(true);
    const response = await authClient.signIn.email({
      ...result.data,
      callbackURL: getSafeCallbackUrl(searchParams.get("callbackUrl")),
    });

    if (response.error) {
      setError("We could not sign you in. Check your email and password.");
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input autoComplete="email" id="email" name="email" placeholder="you@example.com" type="email" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Input autoComplete="current-password" id="password" name="password" type="password" />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

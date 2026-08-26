"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getSafeCallbackUrl, signInSchema } from "@/lib/auth/validation";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const [invalidField, setInvalidField] = useState<"email" | "password">();
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setInvalidField(undefined);

    const formData = new FormData(event.currentTarget);
    const result = signInSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      const field = result.error.issues[0]?.path[0] === "password" ? "password" : "email";
      setError(result.error.issues[0]?.message ?? "Check your sign-in details.");
      setInvalidField(field);
      requestAnimationFrame(() => (field === "password" ? passwordRef : emailRef).current?.focus());
      return;
    }

    setPending(true);
    const response = await authClient.signIn.email({
      ...result.data,
      callbackURL: getSafeCallbackUrl(searchParams?.get("callbackUrl")),
    });

    if (response.error) {
      setError("We could not sign you in. Check your email and password.");
      setInvalidField("email");
      setPending(false);
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }

  return (
    <form className="space-y-5" method="post" noValidate onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input aria-describedby={invalidField === "email" ? "sign-in-error" : undefined} aria-invalid={invalidField === "email" || undefined} autoComplete="email" id="email" name="email" placeholder="you@example.com" ref={emailRef} type="email" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Input aria-describedby={invalidField === "password" ? "sign-in-error" : undefined} aria-invalid={invalidField === "password" || undefined} autoComplete="current-password" id="password" name="password" ref={passwordRef} type="password" />
      </div>
      {error && <p className="text-sm text-destructive" id="sign-in-error" role="alert">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

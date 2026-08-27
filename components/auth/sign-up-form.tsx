"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/auth/validation";

export function SignUpForm() {
  const [error, setError] = useState<string>();
  const [invalidField, setInvalidField] = useState<"name" | "email" | "password">();
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setInvalidField(undefined);

    const formData = new FormData(event.currentTarget);
    const result = signUpSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!result.success) {
      const issueField = result.error.issues[0]?.path[0];
      const field = issueField === "email" || issueField === "password" ? issueField : "name";
      setError(result.error.issues[0]?.message ?? "Check your account details.");
      setInvalidField(field);
      requestAnimationFrame(() => {
        const target = field === "email" ? emailRef : field === "password" ? passwordRef : nameRef;
        target.current?.focus();
      });
      return;
    }

    setPending(true);
    const response = await authClient.signUp.email({
      ...result.data,
      callbackURL: "/dashboard",
    });

    if (response.error) {
      setError("We could not create the account. Try signing in if this email is already registered.");
      setInvalidField("email");
      setPending(false);
      requestAnimationFrame(() => emailRef.current?.focus());
    }
  }

  return (
    <form className="space-y-5" method="post" noValidate onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input aria-describedby={invalidField === "name" ? "sign-up-error" : undefined} aria-invalid={invalidField === "name" || undefined} autoComplete="name" id="name" name="name" placeholder="Your name" ref={nameRef} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input aria-describedby={invalidField === "email" ? "sign-up-error" : undefined} aria-invalid={invalidField === "email" || undefined} autoComplete="email" id="email" name="email" placeholder="you@example.com" ref={emailRef} type="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input aria-describedby={invalidField === "password" ? "password-hint sign-up-error" : "password-hint"} aria-invalid={invalidField === "password" || undefined} autoComplete="new-password" id="password" name="password" ref={passwordRef} type="password" />
        <p className="text-xs leading-5 text-muted-foreground" id="password-hint">Use at least 10 characters with a letter and a number.</p>
      </div>
      {error && <p className="text-sm text-destructive" id="sign-up-error" role="alert">{error}</p>}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      description="Open the live view, forecasts, alerts, and reports for your solar site."
      footer={<>New to Aelora? <Link className="rounded-sm font-semibold text-[#875b00] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d78bd]" href="/sign-up">Create an account</Link></>}
      title="Welcome back"
    >
      <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-muted" />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}

import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthCard
      description="Use your Aelora account to open the solar workspace."
      footer={<>New to Aelora? <Link className="font-semibold text-primary hover:underline" href="/sign-up">Create an account</Link></>}
      title="Welcome back"
    >
      <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-muted" />}>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthCard
      description="Create your account. Your first simulated solar site will be added during onboarding."
      footer={<>Already have an account? <Link className="font-semibold text-primary hover:underline" href="/sign-in">Sign in</Link></>}
      title="Create your account"
    >
      <SignUpForm />
    </AuthCard>
  );
}

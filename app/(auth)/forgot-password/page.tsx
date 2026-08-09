import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Password-reset delivery is prepared, but an email provider must be connected before messages can be sent."
      footer={<Link className="font-semibold text-primary hover:underline" href="/sign-in">Return to sign in</Link>}
      title="Reset your password"
    >
      <div className="rounded-xl border border-forecast/25 bg-forecast/10 p-5 text-sm leading-6">
        <MailCheck aria-hidden="true" className="mb-3 size-5 text-forecast-strong" />
        Email delivery will be enabled in the notification phase. No reset token or account detail is exposed in development logs.
      </div>
    </AuthCard>
  );
}

"use client";

import { Cable, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfigurationField } from "@/components/configuration/field";
import { Button } from "@/components/ui/button";

type Enrollment = {
  enrollmentToken: string;
  enrollmentExpiresAt: string;
};

export function GatewaySetup({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setEnrollment(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/sites/${siteId}/gateways`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("gatewayName"),
        mode: "VIRTUAL",
        expectedIntervalSec: Number(form.get("expectedIntervalSec")),
      }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "Unable to create the gateway enrollment.");
      return;
    }
    setEnrollment(payload.data);
    setMessage("Enrollment created. Copy the token into the separate Python gateway now.");
    router.refresh();
  }

  async function copyToken() {
    if (enrollment) await navigator.clipboard.writeText(enrollment.enrollmentToken);
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <ConfigurationField defaultValue="Development virtual plant" label="Gateway name" name="gatewayName" required />
      <ConfigurationField defaultValue="30" hint="Aelora marks delayed equipment stale after missed intervals." label="Publish interval (seconds)" max="3600" min="10" name="expectedIntervalSec" required type="number" />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit"><Plus aria-hidden="true" />{pending ? "Creating..." : "Create enrollment"}</Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
      </div>
      {enrollment ? (
        <section aria-label="One-time gateway enrollment" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3"><Cable aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">Use this token in the separate Python gateway</p><p className="mt-1 text-sm leading-6 text-muted-foreground">This secret is shown only in this response and expires at {new Date(enrollment.enrollmentExpiresAt).toLocaleString()}.</p></div></div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background p-3 text-xs">{enrollment.enrollmentToken}</code><Button onClick={() => void copyToken()} type="button" variant="outline"><Copy aria-hidden="true" />Copy token</Button></div>
        </section>
      ) : null}
    </form>
  );
}

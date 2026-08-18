"use client";

import { Copy, KeyRound, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Rotation = {
  credential: string;
  expiresAt: string;
  credentialVersion: number;
};

export function GatewayCredentialActions({
  siteId,
  gateway,
}: {
  siteId: string;
  gateway: { id: string; name: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"rotate" | "revoke" | null>(null);
  const [rotation, setRotation] = useState<Rotation | null>(null);
  const [message, setMessage] = useState("");

  async function rotate() {
    setPending("rotate");
    setRotation(null);
    setMessage("");
    const response = await fetch(
      `/api/sites/${siteId}/gateways/${gateway.id}/credential-rotations`,
      { method: "POST" },
    );
    const payload = await response.json().catch(() => null);
    setPending(null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "Unable to stage a credential rotation.");
      return;
    }
    setRotation(payload.data);
    setMessage("Rotation staged. The current credential remains active until the new credential is used.");
  }

  async function revoke() {
    if (!confirm(`Revoke ${gateway.name}? Its telemetry and heartbeat requests will stop immediately.`)) return;
    setPending("revoke");
    setMessage("");
    const response = await fetch(
      `/api/sites/${siteId}/gateways/${gateway.id}/revocations`,
      { method: "POST" },
    );
    const payload = await response.json().catch(() => null);
    setPending(null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "Unable to revoke this gateway.");
      return;
    }
    setMessage("Gateway revoked. Stored history remains available.");
    router.refresh();
  }

  async function copyCredential() {
    if (rotation) await navigator.clipboard.writeText(rotation.credential);
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          aria-label={`Rotate credential for ${gateway.name}`}
          disabled={pending !== null}
          onClick={() => void rotate()}
          size="sm"
          type="button"
          variant="outline"
        >
          <KeyRound aria-hidden="true" />
          {pending === "rotate" ? "Staging..." : "Rotate credential"}
        </Button>
        <Button
          aria-label={`Revoke ${gateway.name}`}
          disabled={pending !== null}
          onClick={() => void revoke()}
          size="sm"
          type="button"
          variant="destructive"
        >
          <ShieldX aria-hidden="true" />
          {pending === "revoke" ? "Revoking..." : "Revoke"}
        </Button>
      </div>
      <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">{message}</p>
      {rotation ? (
        <section aria-label="One-time rotated gateway credential" className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm font-semibold">Paste it into the local gateway console</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Credential v{rotation.credentialVersion} is shown once and expires {new Date(rotation.expiresAt).toLocaleString()} if unused.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background p-2 text-xs">{rotation.credential}</code>
            <Button onClick={() => void copyCredential()} size="sm" type="button" variant="outline">
              <Copy aria-hidden="true" />
              Copy
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

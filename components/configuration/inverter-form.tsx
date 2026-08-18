"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfigurationField } from "@/components/configuration/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type InverterValues = { manufacturer: string; model: string; serialAlias: string | null; acRatingW: number; efficiencyPct: number; phase: number; communicationAdapter: string; pollingIntervalSec: number };

export function InverterForm({ siteId, inverter }: { siteId: string; inverter?: InverterValues | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const response = await fetch(`/api/sites/${siteId}/inverter`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const payload = await response.json().catch(() => null); setPending(false);
    setMessage(response.ok ? "Inverter settings saved." : payload?.error?.message ?? "Unable to save inverter settings.");
    if (response.ok) router.refresh();
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue={inverter?.manufacturer ?? "Aelora Virtual"} label="Manufacturer" name="manufacturer" required /><ConfigurationField defaultValue={inverter?.model ?? "Digital Twin 6K"} label="Model" name="model" required /></div>
      <ConfigurationField defaultValue={inverter?.serialAlias ?? ""} label="Serial alias" name="serialAlias" hint="A display alias only; never enter a secret or credential." />
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue={inverter?.acRatingW ?? 6000} label="AC rating" min="100" name="acRatingW" required type="number" hint="Watts" /><ConfigurationField defaultValue={inverter?.efficiencyPct ?? 97.5} label="Efficiency" max="100" min="50" name="efficiencyPct" required step="0.1" type="number" hint="Percent" /></div>
      <div className="grid gap-4 sm:grid-cols-3"><ConfigurationField defaultValue={inverter?.phase ?? 1} label="Phase" max="3" min="1" name="phase" required type="number" /><div className="space-y-2"><Label htmlFor="communicationAdapter">Communication adapter</Label><select className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" defaultValue={inverter?.communicationAdapter ?? "SIMULATOR"} id="communicationAdapter" name="communicationAdapter"><option value="SIMULATOR">Simulator</option><option value="HTTP_PUSH">HTTP push</option><option value="MQTT">MQTT</option><option value="MODBUS">Modbus</option></select></div><ConfigurationField defaultValue={inverter?.pollingIntervalSec ?? 15} label="Polling interval" min="5" name="pollingIntervalSec" required type="number" hint="Seconds" /></div>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : "Save inverter"}</Button><p aria-live="polite" className="text-sm text-muted-foreground">{message}</p></div>
    </form>
  );
}

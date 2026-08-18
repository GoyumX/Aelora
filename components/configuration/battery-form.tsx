"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfigurationField } from "@/components/configuration/field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type BatteryValues = { enabled: boolean; manufacturer: string | null; model: string | null; usableCapacityWh: number; maxChargePowerW: number; maxDischargePowerW: number; minSocPct: number; maxSocPct: number; roundTripEfficiencyPct: number; reservePct: number };

export function BatteryForm({ siteId, battery }: { siteId: string; battery?: BatteryValues | null }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget)); values.enabled = values.enabled === "on" ? "true" : "false";
    const response = await fetch(`/api/sites/${siteId}/battery`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const payload = await response.json().catch(() => null); setPending(false);
    setMessage(response.ok ? "Battery settings saved." : payload?.error?.message ?? "Unable to save battery settings."); if (response.ok) router.refresh();
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4"><input className="size-4 accent-primary" defaultChecked={battery?.enabled ?? false} id="enabled" name="enabled" type="checkbox" /><div><Label htmlFor="enabled">Battery installed and enabled</Label><p className="mt-1 text-xs text-muted-foreground">Leave this off when the solar site has no battery.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue={battery?.manufacturer ?? ""} label="Manufacturer" name="manufacturer" placeholder="Optional" /><ConfigurationField defaultValue={battery?.model ?? ""} label="Model" name="model" placeholder="Optional" /></div>
      <div className="grid gap-4 sm:grid-cols-3"><ConfigurationField defaultValue={battery?.usableCapacityWh ?? 10000} label="Usable capacity" min="100" name="usableCapacityWh" required type="number" hint="Watt-hours" /><ConfigurationField defaultValue={battery?.maxChargePowerW ?? 3000} label="Max charge power" min="0" name="maxChargePowerW" required type="number" hint="Watts" /><ConfigurationField defaultValue={battery?.maxDischargePowerW ?? 3000} label="Max discharge power" min="0" name="maxDischargePowerW" required type="number" hint="Watts" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><ConfigurationField defaultValue={battery?.minSocPct ?? 10} label="Minimum SoC" max="100" min="0" name="minSocPct" required type="number" hint="Percent" /><ConfigurationField defaultValue={battery?.maxSocPct ?? 95} label="Maximum SoC" max="100" min="0" name="maxSocPct" required type="number" hint="Percent" /><ConfigurationField defaultValue={battery?.reservePct ?? 20} label="Reserve" max="100" min="0" name="reservePct" required type="number" hint="Percent" /><ConfigurationField defaultValue={battery?.roundTripEfficiencyPct ?? 92} label="Round-trip efficiency" max="100" min="50" name="roundTripEfficiencyPct" required step="0.1" type="number" hint="Percent" /></div>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : "Save battery"}</Button><p aria-live="polite" className="text-sm text-muted-foreground">{message}</p></div>
    </form>
  );
}

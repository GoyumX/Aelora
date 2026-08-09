"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfigurationField } from "@/components/configuration/field";
import { Button } from "@/components/ui/button";

export function SolarArrayForm({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setMessage("");
    const form = new FormData(formElement);
    const response = await fetch(`/api/sites/${siteId}/solar-arrays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error?.message ?? "Unable to add the solar array.");
      return;
    }
    formElement.reset();
    setMessage("Solar array added.");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField label="Array name" name="name" placeholder="West roof" required /><ConfigurationField label="Manufacturer" name="manufacturer" placeholder="Optional" /></div>
      <ConfigurationField label="Panel model" name="model" placeholder="Optional" />
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue="10" label="Panel count" min="1" name="panelCount" required type="number" /><ConfigurationField defaultValue="440" label="Rated power per panel" min="50" name="ratedPowerW" required type="number" hint="Watts" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue="18" label="Tilt" max="90" min="0" name="tiltDeg" required step="0.1" type="number" hint="Degrees from horizontal" /><ConfigurationField defaultValue="270" label="Azimuth" max="360" min="0" name="azimuthDeg" required step="0.1" type="number" hint="0° north, 90° east, 180° south, 270° west" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField label="Installation date" name="installationDate" type="date" /><ConfigurationField label="Temperature coefficient" max="0" min="-2" name="temperatureCoefficientPctC" step="0.01" type="number" hint="Optional %/°C value" /></div>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} size="lg" type="submit"><Plus aria-hidden="true" />{pending ? "Adding…" : "Add solar array"}</Button><p aria-live="polite" className="text-sm text-muted-foreground">{message}</p></div>
    </form>
  );
}

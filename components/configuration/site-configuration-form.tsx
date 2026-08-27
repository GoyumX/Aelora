"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfigurationField } from "@/components/configuration/field";
import { Button } from "@/components/ui/button";

type SiteValues = { id: string; name: string; latitude: number; longitude: number; timezone: string };

export function SiteConfigurationForm({ site }: { site: SiteValues }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/sites/${site.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setPending(false);
      setMessage(payload?.error?.message ?? "Unable to save site configuration.");
      return;
    }

    let weatherRefreshed = false;
    try {
      const weatherResponse = await fetch(`/api/sites/${site.id}/weather`, { method: "POST" });
      weatherRefreshed = weatherResponse.ok;
    } catch {
      weatherRefreshed = false;
    }
    setPending(false);
    setMessage(weatherRefreshed
      ? "Site configuration saved and weather refreshed."
      : "Site configuration saved. Weather refresh is pending; the last stored observation remains visible.");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <ConfigurationField defaultValue={site.name} label="Site name" name="name" required />
      <div className="grid gap-4 sm:grid-cols-2"><ConfigurationField defaultValue={site.latitude} label="Latitude" max="90" min="-90" name="latitude" required step="any" type="number" /><ConfigurationField defaultValue={site.longitude} label="Longitude" max="180" min="-180" name="longitude" required step="any" type="number" /></div>
      <ConfigurationField defaultValue={site.timezone} label="IANA timezone" name="timezone" required hint="For example: Asia/Colombo" />
      <div className="flex flex-wrap items-center gap-3"><Button disabled={pending} type="submit"><Save aria-hidden="true" />{pending ? "Saving..." : "Save site"}</Button><p aria-live="polite" className="text-sm text-muted-foreground">{message}</p></div>
    </form>
  );
}

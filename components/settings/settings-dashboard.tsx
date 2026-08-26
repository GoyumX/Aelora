"use client";

import { Bell, Check, Globe2, KeyRound, Laptop, LoaderCircle, LogOut, Monitor, Moon, Palette, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsView } from "@/lib/settings/settings-service";
import type { MeasurementSystemValue, ThemePreferenceValue } from "@/lib/settings/settings";

const timezones = ["Asia/Colombo", "Asia/Kolkata", "UTC", "Europe/London", "America/New_York", "Australia/Sydney"];
const themes: Array<{ value: ThemePreferenceValue; label: string; description: string; icon: typeof Sun }> = [
  { value: "LIGHT", label: "Light", description: "Bright and clear", icon: Sun },
  { value: "DARK", label: "Dark", description: "Comfortable at night", icon: Moon },
  { value: "SYSTEM", label: "System", description: "Follow this device", icon: Monitor },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function themeClientValue(theme: ThemePreferenceValue) { return theme.toLowerCase(); }

async function responseMessage(response: Response, fallback: string) {
  try { return (await response.json()).error?.message ?? fallback; } catch { return fallback; }
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";
  if (userAgent.length <= 90) return userAgent;
  return `${userAgent.slice(0, 87)}…`;
}

export function SettingsDashboard({ view }: { view: SettingsView }) {
  const { setTheme } = useTheme();
  const [name, setName] = useState(view.profile.name);
  const [username, setUsername] = useState(view.profile.username ?? "");
  const [theme, setThemePreference] = useState<ThemePreferenceValue>(view.preferences.theme);
  const [timezone, setTimezone] = useState(view.preferences.timezone);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystemValue>(view.preferences.measurementSystem);
  const [emailNotifications, setEmailNotifications] = useState(view.preferences.emailNotifications);
  const [defaultSiteId, setDefaultSiteId] = useState(view.preferences.defaultSiteId ?? "");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sessions, setSessions] = useState(view.sessions);
  const [sessionsPending, setSessionsPending] = useState(false);

  function chooseTheme(value: ThemePreferenceValue) {
    setThemePreference(value);
    setTheme(themeClientValue(value));
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, username: username.trim() || null, theme, timezone, measurementSystem, emailNotifications, defaultSiteId: defaultSiteId || null }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Settings could not be saved."));
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setPasswordPending(true);
    try {
      const response = await fetch("/api/settings/security", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      if (!response.ok) throw new Error(await responseMessage(response, "Password could not be updated."));
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setSessions((current) => current.filter((session) => session.isCurrent));
      toast.success("Password updated. Other sessions were signed out.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password could not be updated.");
    } finally { setPasswordPending(false); }
  }

  async function revokeOtherSessions() {
    setSessionsPending(true);
    try {
      const response = await fetch("/api/settings/security", { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response, "Other sessions could not be signed out."));
      setSessions((current) => current.filter((session) => session.isCurrent));
      toast.success("Other sessions signed out");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Other sessions could not be signed out.");
    } finally { setSessionsPending(false); }
  }

  const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;

  return <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
    <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div>
        <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Personal workspace</p><Badge variant="outline"><ShieldCheck aria-hidden="true" className="mr-1 size-3" />{view.profile.role === "ADMIN" ? "Administrator" : "User account"}</Badge></div>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">Manage your identity, preferred solar site, display experience, notifications, password, and signed-in devices.</p>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
        <Avatar className="size-11" size="lg">{view.profile.image ? <AvatarImage alt="" src={view.profile.image} /> : null}<AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
        <div className="min-w-0"><p className="truncate font-semibold">{name || view.profile.name}</p><p className="truncate text-xs text-muted-foreground">{view.profile.email}</p></div>
      </div>
    </header>

    <form className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]" onSubmit={saveSettings}>
      <div className="space-y-6">
        <Card className="scroll-mt-24" id="profile">
          <CardHeader><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Profile</h2></CardTitle><CardDescription className="mt-1">Manage how your account is identified throughout Aelora.</CardDescription></div></div></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} /></div>
            <div className="space-y-2"><Label htmlFor="username">Username</Label><Input autoCapitalize="none" autoComplete="username" id="username" maxLength={30} onChange={(event) => setUsername(event.target.value)} placeholder="your.solar.name" spellCheck={false} value={username} /><p className="text-xs text-muted-foreground">3–30 letters or numbers; dots, underscores, and hyphens are allowed.</p></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="account-email">Email address</Label><Input disabled id="account-email" type="email" value={view.profile.email} /><p className="text-xs text-muted-foreground">Your verified sign-in address. Email changes require a separate verification flow.</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Palette aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Appearance</h2></CardTitle><CardDescription className="mt-1">Theme changes preview immediately and are saved to your PostgreSQL preference record.</CardDescription></div></div></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">{themes.map(({ value, label, description, icon: Icon }) => <button aria-label={`Use ${label.toLowerCase()} theme`} className={`relative rounded-xl border p-4 text-left transition-colors hover:border-primary/50 ${theme === value ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "bg-background"}`} key={value} onClick={() => chooseTheme(value)} type="button"><Icon aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p>{theme === value ? <Check aria-hidden="true" className="absolute right-3 top-3 size-4 text-primary" /> : null}</button>)}</CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Globe2 aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Application preferences</h2></CardTitle><CardDescription className="mt-1">Defaults used when Aelora opens and formats future views.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="timezone">Timezone</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="timezone" onChange={(event) => setTimezone(event.target.value)} value={timezone}>{!timezones.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}{timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="default-site">Default solar site</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="default-site" onChange={(event) => setDefaultSiteId(event.target.value)} value={defaultSiteId}><option value="">No default site</option>{view.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="units">Measurement units</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="units" onChange={(event) => setMeasurementSystem(event.target.value as MeasurementSystemValue)} value={measurementSystem}><option value="METRIC">Metric · °C, kW, kWh</option><option value="IMPERIAL">Imperial · °F where applicable</option></select></div>
            <button aria-checked={emailNotifications} className="flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left" onClick={() => setEmailNotifications((current) => !current)} role="switch" type="button"><span><span className="flex items-center gap-2 font-medium"><Bell aria-hidden="true" className="size-4 text-primary" />Email notifications</span><span className="mt-1 block text-xs text-muted-foreground">Receive important alert and report updates</span></span><span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${emailNotifications ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${emailNotifications ? "translate-x-6" : "translate-x-1"}`} /></span></button>
          </CardContent>
        </Card>
        <Button className="w-full" disabled={saving} size="lg" type="submit">{saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}Save settings</Button>
      </div>
    </form>

    <section aria-labelledby="security-heading" className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound aria-hidden="true" className="size-5" /></span><div><CardTitle><h2 id="security-heading">Password</h2></CardTitle><CardDescription className="mt-1">Updating your password keeps this device signed in and revokes every other session.</CardDescription></div></div></CardHeader>
        <CardContent><form className="space-y-4" onSubmit={changePassword}><div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input autoComplete="current-password" id="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input autoComplete="new-password" id="new-password" minLength={10} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input autoComplete="new-password" id="confirm-password" minLength={10} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></div></div>{passwordError ? <p className="text-sm text-destructive" role="alert">{passwordError}</p> : null}<div className="flex flex-wrap items-center justify-between gap-3"><Button disabled={passwordPending} type="submit" variant="outline">{passwordPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <KeyRound aria-hidden="true" className="size-4" />}Update password</Button><Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">Reset a forgotten password</Link></div></form></CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Laptop aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Active sessions</h2></CardTitle><CardDescription className="mt-1">Only safe device metadata is displayed; authentication tokens never reach this page.</CardDescription></div></div>{otherSessionCount ? <Button disabled={sessionsPending} onClick={revokeOtherSessions} size="sm" type="button" variant="outline"><LogOut aria-hidden="true" className="size-4" />Sign out other sessions</Button> : null}</div></CardHeader>
        <CardContent className="space-y-3">{sessions.map((session) => <div className="flex items-start justify-between gap-3 rounded-xl border p-3" key={session.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{deviceLabel(session.userAgent)}</p>{session.isCurrent ? <Badge className="border-energy/25 bg-energy/10 text-energy-strong" variant="outline">Current session</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{session.ipAddress ?? "IP unavailable"} · Active {new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.updatedAt))}</p></div><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /></div>)}</CardContent>
      </Card>
    </section>
  </main>;
}

"use client";

import { AlertTriangle, ArrowRight, BookOpen, Bot, CheckCircle2, ChevronDown, CircleHelp, Clock3, FileQuestion, LifeBuoy, LoaderCircle, Mail, MessageSquarePlus, Search, Send, Server, ShieldAlert, Sparkles, TicketCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchSupportContent, type SupportTicketCreate } from "@/lib/support/support";
import type { SupportTicketView, SupportView } from "@/lib/support/support-service";

const categoryLabels: Record<SupportTicketView["category"], string> = { TECHNICAL: "Technical issue", ACCOUNT: "Account", DATA_FORECAST: "Data or forecast", FEATURE_REQUEST: "Feature request" };
const statusLabels: Record<SupportTicketView["status"], string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" };

async function responseMessage(response: Response, fallback: string) { try { return (await response.json()).error?.message ?? fallback; } catch { return fallback; } }

function statusTone(status: SupportTicketView["status"]) {
  if (status === "RESOLVED" || status === "CLOSED") return "border-energy/25 bg-energy/10 text-energy-strong";
  if (status === "IN_PROGRESS") return "border-primary/25 bg-primary/10 text-primary";
  return "";
}

export function HelpSupportDashboard({ view }: { view: SupportView }) {
  const [query, setQuery] = useState("");
  const content = useMemo(() => searchSupportContent(query), [query]);
  const [tickets, setTickets] = useState(view.tickets);
  const [category, setCategory] = useState<SupportTicketCreate["category"]>("TECHNICAL");
  const [priority, setPriority] = useState<SupportTicketCreate["priority"]>("NORMAL");
  const [siteId, setSiteId] = useState(view.sites[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitTicket(event: FormEvent) {
    event.preventDefault(); setPending(true); setFormError(null);
    try {
      const response = await fetch("/api/support-tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category, priority, subject, message, siteId: siteId || null }) });
      if (!response.ok) throw new Error(await responseMessage(response, "The support ticket could not be submitted."));
      const created = (await response.json()).data as SupportTicketView;
      setTickets((current) => [created, ...current]); setSubject(""); setMessage(""); setPriority("NORMAL");
      toast.success("Support ticket submitted");
    } catch (error) { setFormError(error instanceof Error ? error.message : "The support ticket could not be submitted."); }
    finally { setPending(false); }
  }

  const noResults = content.articles.length === 0 && content.faqs.length === 0;

  return <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-7 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
    <header className="relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,var(--card),color-mix(in_oklch,var(--primary)_9%,var(--card)))] p-6 shadow-sm sm:p-8 lg:p-10">
      <div aria-hidden="true" className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative max-w-4xl"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline"><LifeBuoy aria-hidden="true" className="mr-1 size-3" />Help centre</Badge><Badge className="border-energy/25 bg-energy/10 text-energy-strong" variant="outline"><CheckCircle2 aria-hidden="true" className="mr-1 size-3" />Local support available</Badge></div><h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">How can we help, {view.user.name.split(" ")[0]}?</h1><p className="mt-3 max-w-2xl text-muted-foreground">Search practical guides, understand Aelora’s evidence boundaries, or create a ticket that your administrator can review inside the platform.</p>
        <div className="relative mt-6 max-w-2xl"><Search aria-hidden="true" className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search guides and questions" className="h-12 rounded-2xl bg-background pl-12 pr-4 shadow-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Search guides and questions" value={query} /></div>
      </div>
    </header>

    <section aria-label="Quick help" className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Server aria-hidden="true" className="size-5" /></span><CardTitle className="mt-3"><h2>Connect your system</h2></CardTitle><CardDescription>Configure equipment and verify gateway freshness.</CardDescription></CardHeader><CardContent><Link className={buttonVariants({ variant: "outline" })} href="/system-configuration">Open configuration<ArrowRight aria-hidden="true" className="size-4" /></Link></CardContent></Card>
      <Card><CardHeader><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bot aria-hidden="true" className="size-5" /></span><CardTitle className="mt-3"><h2>Understand AI output</h2></CardTitle><CardDescription>Review model, weather, horizon, and confidence limitations.</CardDescription></CardHeader><CardContent><Link className={buttonVariants({ variant: "outline" })} href="/ai-forecast">Open AI Forecast<ArrowRight aria-hidden="true" className="size-4" /></Link></CardContent></Card>
      <Card><CardHeader><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><AlertTriangle aria-hidden="true" className="size-5" /></span><CardTitle className="mt-3"><h2>Troubleshoot incidents</h2></CardTitle><CardDescription>Inspect exact evidence before acknowledging or resolving.</CardDescription></CardHeader><CardContent><Link className={buttonVariants({ variant: "outline" })} href="/alerts">Open alerts<ArrowRight aria-hidden="true" className="size-4" /></Link></CardContent></Card>
    </section>

    <section className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,.75fr)]">
      <div className="space-y-7">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Guides</p><h2 className="mt-1 font-heading text-2xl font-semibold">Walkthroughs for the whole system</h2><p className="mt-2 text-sm text-muted-foreground">Each guide links directly to the relevant working page.</p></div>
        {noResults ? <Card className="border-dashed"><CardHeader><FileQuestion aria-hidden="true" className="size-6 text-muted-foreground" /><CardTitle className="mt-3">No help content matched “{query}”</CardTitle><CardDescription>Try a shorter phrase such as gateway, battery, forecast, alerts, or reports.</CardDescription></CardHeader></Card> : null}
        <div className="grid gap-4 lg:grid-cols-2">{content.articles.map((article) => <Card className="flex flex-col" key={article.id}><CardHeader><div className="flex items-center justify-between gap-3"><Badge variant="outline">{article.category.replaceAll("_", " ").toLocaleLowerCase()}</Badge><BookOpen aria-hidden="true" className="size-4 text-primary" /></div><CardTitle className="mt-3"><h3>{article.title}</h3></CardTitle><CardDescription>{article.summary}</CardDescription></CardHeader><CardContent className="mt-auto space-y-4"><details className="group rounded-xl border bg-muted/20 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">Show steps<ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /></summary><ol className="mt-3 space-y-2 pl-5 text-xs leading-5 text-muted-foreground">{article.steps.map((step) => <li className="list-decimal" key={step}>{step}</li>)}</ol></details><Link className={buttonVariants({ variant: "outline" })} href={article.href}>Open relevant page<ArrowRight aria-hidden="true" className="size-4" /></Link></CardContent></Card>)}</div>

        {content.faqs.length ? <section aria-labelledby="faq-heading" className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">FAQ</p><h2 className="mt-1 font-heading text-2xl font-semibold" id="faq-heading">Frequently asked questions</h2></div><div className="space-y-3">{content.faqs.map((faq) => <details className="group rounded-xl border bg-card p-4 shadow-sm" key={faq.id}><summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-medium"><span className="flex items-start gap-3"><CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{faq.question}</span><ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180" /></summary><p className="ml-7 mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p></details>)}</div></section> : null}
      </div>

      <aside className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><MessageSquarePlus aria-hidden="true" className="size-5" /></span><div><CardTitle><h2>Create a support ticket</h2></CardTitle><CardDescription className="mt-1">Stored locally for an administrator. We will associate your account email: {view.user.email}.</CardDescription></div></div></CardHeader>
          <CardContent><form className="space-y-4" onSubmit={submitTicket}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><div className="space-y-2"><Label htmlFor="ticket-category">Category</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="ticket-category" onChange={(event) => setCategory(event.target.value as SupportTicketCreate["category"])} value={category}><option value="TECHNICAL">Technical issue</option><option value="ACCOUNT">Account</option><option value="DATA_FORECAST">Data or forecast</option><option value="FEATURE_REQUEST">Feature request</option></select></div><div className="space-y-2"><Label htmlFor="ticket-priority">Priority</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="ticket-priority" onChange={(event) => setPriority(event.target.value as SupportTicketCreate["priority"])} value={priority}><option value="NORMAL">Normal</option><option value="HIGH">High</option></select></div></div>
            <div className="space-y-2"><Label htmlFor="ticket-site">Related site</Label><select className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" id="ticket-site" onChange={(event) => setSiteId(event.target.value)} value={siteId}><option value="">No specific site</option>{view.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="ticket-subject">Subject</Label><Input id="ticket-subject" maxLength={120} minLength={5} onChange={(event) => setSubject(event.target.value)} required value={subject} /></div>
            <div className="space-y-2"><Label htmlFor="ticket-message">Describe the issue</Label><textarea className="min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" id="ticket-message" maxLength={2000} minLength={20} onChange={(event) => setMessage(event.target.value)} placeholder="What happened, when did it start, and what have you checked?" required value={message} /></div>
            {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}<Button className="w-full" disabled={pending} size="lg" type="submit">{pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}Submit support ticket</Button>
            <p className="text-xs leading-5 text-muted-foreground"><Mail aria-hidden="true" className="mr-1 inline size-3.5" />Tickets stay inside this Aelora database; no email is sent in this milestone.</p>
          </form></CardContent>
        </Card>

        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle><h2>Your tickets</h2></CardTitle><CardDescription className="mt-1">Latest account-owned requests</CardDescription></div><TicketCheck aria-hidden="true" className="size-5 text-primary" /></div></CardHeader><CardContent className="space-y-3">{tickets.length ? tickets.map((ticket) => <article className="rounded-xl border p-3" key={ticket.id}><div className="flex flex-wrap items-center justify-between gap-2"><Badge className={statusTone(ticket.status)} variant="outline">{statusLabels[ticket.status]}</Badge><span className="text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="mr-1 inline size-3" />{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(new Date(ticket.createdAt))}</span></div><h3 className="mt-3 text-sm font-semibold">{ticket.subject}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{ticket.message}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{categoryLabels[ticket.category]}</span>{ticket.site ? <><span aria-hidden="true">·</span><span>{ticket.site.name}</span></> : null}{ticket.priority === "HIGH" ? <Badge variant="destructive">High priority</Badge> : null}</div>{ticket.adminResponse ? <div className="mt-3 rounded-lg bg-primary/5 p-3 text-xs leading-5"><strong>Administrator response</strong><p className="mt-1 text-muted-foreground">{ticket.adminResponse}</p></div> : null}</article>) : <p className="text-sm text-muted-foreground">You have not submitted a support ticket yet.</p>}</CardContent></Card>
      </aside>
    </section>

    <section aria-label="Important evidence boundaries" className="grid gap-4 lg:grid-cols-3">
      <Card className="border-amber-500/20 bg-amber-500/5"><CardHeader><ShieldAlert aria-hidden="true" className="size-5 text-amber-600" /><CardTitle className="mt-3"><h2>Simulation evidence</h2></CardTitle><CardDescription>Simulated telemetry is not measured hardware evidence. It is suitable for development, demonstrations, and deterministic scenario testing.</CardDescription></CardHeader></Card>
      <Card className="border-primary/20 bg-primary/5"><CardHeader><Sparkles aria-hidden="true" className="size-5 text-primary" /><CardTitle className="mt-3"><h2>Model limitations</h2></CardTitle><CardDescription>Forecasts depend on weather quality, training coverage, system configuration, and horizon. Predictions are estimates—not guarantees or control commands.</CardDescription></CardHeader></Card>
      <Card><CardHeader><FileQuestion aria-hidden="true" className="size-5 text-primary" /><CardTitle className="mt-3"><h2>Operational safety</h2></CardTitle><CardDescription>Aelora is a monitoring and decision-support application. Follow qualified installer and equipment-vendor procedures before changing physical electrical systems.</CardDescription></CardHeader></Card>
    </section>
  </main>;
}

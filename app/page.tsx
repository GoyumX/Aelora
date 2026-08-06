import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BrainCircuit,
  ChartNoAxesCombined,
  CheckCircle2,
  CloudSun,
  Cpu,
  Gauge,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AeloraMark } from "@/components/brand/aelora-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Solar intelligence for every day",
  description:
    "Monitor solar performance, understand anomalies, and forecast energy production—even before connecting physical hardware.",
};

const capabilities = [
  {
    icon: Activity,
    title: "Live monitoring",
    description:
      "See generation, consumption, grid flow, battery state, and system freshness in one operational view.",
    accent: "bg-energy/12 text-energy-strong",
  },
  {
    icon: BrainCircuit,
    title: "AI forecasting",
    description:
      "Plan around a 48-hour summary, detailed seven-day outlook, and a clearly labelled monthly estimate.",
    accent: "bg-forecast/12 text-forecast-strong",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Performance clarity",
    description:
      "Compare expected and actual production, investigate losses, and identify underperforming equipment.",
    accent: "bg-solar/14 text-solar-strong",
  },
];

const workflow = [
  { number: "01", title: "Configure", text: "Add your site, panel array, inverter, and optional battery." },
  { number: "02", title: "Simulate", text: "Start with a transparent digital twin while physical hardware is unavailable." },
  { number: "03", title: "Understand", text: "Explore live behavior, forecasts, alerts, and historical performance." },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-hidden bg-background">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-[#102d2e]/45 text-white backdrop-blur-md">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex h-18 max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8"
        >
          <Link className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/">
            <AeloraMark className="[&>span:last-child]:text-white" />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-white/75 md:flex">
            <a className="transition-colors hover:text-white" href="#capabilities">Capabilities</a>
            <a className="transition-colors hover:text-white" href="#simulation">Simulation</a>
            <a className="transition-colors hover:text-white" href="#how-it-works">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <Link className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/sign-in">
              Sign in
            </Link>
            <Link className="hidden rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solar sm:inline-flex" href="/sign-up">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="relative flex min-h-[47rem] items-end bg-[#102d2e] text-white sm:min-h-[50rem] lg:items-center">
          <Image
            alt="Solar panels on a tropical Sri Lankan home at sunrise"
            className="object-cover object-[64%_center] opacity-78"
            fill
            priority
            sizes="100vw"
            src="/images/aelora-solar-home-hero.png"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,38,39,.97)_0%,rgba(8,38,39,.86)_38%,rgba(8,38,39,.26)_76%,rgba(8,38,39,.12)_100%)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#102d2e]/80 to-transparent" />

          <div className="relative mx-auto w-full max-w-[90rem] px-4 pb-16 pt-36 sm:px-6 sm:pb-20 lg:px-8 lg:py-40">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/85 backdrop-blur">
                <Sparkles aria-hidden="true" className="size-3.5 text-solar" />
                Solar monitoring that starts before your hardware does
              </div>
              <h1 className="mt-7 font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">
                Turn sunlight into <span className="text-solar">foresight.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/72 sm:text-xl">
                Monitor every watt, understand system health, and plan the next seven days with explainable solar forecasts built for your site.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link className={cn(buttonVariants({ size: "lg" }), "h-12 bg-solar px-6 text-[#342400] shadow-lg shadow-black/15 hover:bg-solar/90")} href="/sign-up">
                  Start monitoring <ArrowRight aria-hidden="true" />
                </Link>
                <a className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 border-white/20 bg-white/8 px-6 text-white hover:bg-white/15 hover:text-white")} href="#how-it-works">
                  See how it works
                </a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/68">
                {[
                  "No hardware required to begin",
                  "User and admin access",
                  "Simulation clearly labelled",
                ].map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <CheckCircle2 aria-hidden="true" className="size-4 text-energy" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b bg-card/70">
          <div className="mx-auto grid max-w-[90rem] divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            {[
              [Gauge, "One calm workspace", "Live, historical, and forecast views"],
              [CloudSun, "Weather-aware", "Conditions tied to energy expectations"],
              [ShieldCheck, "Site-scoped access", "Private user data and server-side roles"],
            ].map(([Icon, title, text]) => (
              <div className="flex items-center gap-4 py-6 sm:px-6 first:pl-0" key={title as string}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary"><Icon aria-hidden="true" className="size-5" /></span>
                <div><p className="font-semibold">{title as string}</p><p className="mt-0.5 text-sm text-muted-foreground">{text as string}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[90rem] px-4 py-24 sm:px-6 lg:px-8 lg:py-32" id="capabilities">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">One energy workspace</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">Know what your system is doing—and why.</h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Aelora connects operational readings, weather context, and model output without pretending estimates are measurements.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description, accent }) => (
              <article className="rounded-2xl border bg-card p-7 shadow-sm transition-transform hover:-translate-y-1" key={title}>
                <span className={cn("grid size-12 place-items-center rounded-2xl", accent)}><Icon aria-hidden="true" className="size-5" /></span>
                <h3 className="mt-6 font-heading text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#102d2e] text-white" id="simulation">
          <div className="mx-auto grid max-w-[90rem] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-8 lg:py-32">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-energy">Digital twin mode</p>
              <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">Start without hardware</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/68">Your first solar system can run as a transparent simulation using site, equipment, time, and weather assumptions. Later, a real-device adapter can publish the same telemetry contract.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  [SunMedium, "Solar generation", "Daylight and weather-sensitive output"],
                  [Zap, "Household demand", "A configurable residential load profile"],
                  [BatteryCharging, "Battery behavior", "Charge, discharge, reserve, and efficiency"],
                  [Cpu, "Fault scenarios", "Power cuts and equipment anomalies"],
                ].map(([Icon, title, text]) => (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5" key={title as string}>
                    <Icon aria-hidden="true" className="size-5 text-solar" />
                    <h3 className="mt-4 font-semibold">{title as string}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">{text as string}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
              <div className="rounded-2xl border border-white/10 bg-[#173738] p-6">
                <div className="flex items-center justify-between"><div><p className="text-xs text-white/50">Simulated live output</p><p className="mt-1 font-mono text-3xl font-semibold">4.82 kW</p></div><span className="rounded-full bg-energy/15 px-3 py-1 text-xs font-semibold text-energy">● Healthy</span></div>
                <div className="mt-8 flex h-40 items-end gap-2" aria-hidden="true">
                  {[18, 28, 43, 61, 75, 91, 82, 70, 51, 35, 22].map((height, index) => <div className="flex-1 rounded-t bg-gradient-to-t from-energy/35 to-solar" key={index} style={{ height: `${height}%` }} />)}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center"><div><p className="text-xs text-white/45">Today</p><p className="mt-1 font-mono font-semibold">18.4 kWh</p></div><div><p className="text-xs text-white/45">Battery</p><p className="mt-1 font-mono font-semibold">76%</p></div><div><p className="text-xs text-white/45">Forecast</p><p className="mt-1 font-mono font-semibold">+8%</p></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[90rem] px-4 py-24 sm:px-6 lg:px-8 lg:py-32" id="how-it-works">
          <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How it works</p><h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">From setup to insight in three steps.</h2></div>
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {workflow.map((step) => (
              <li className="relative border-t pt-7" key={step.number}><span className="font-mono text-sm font-semibold text-primary">{step.number}</span><h3 className="mt-4 text-xl font-semibold">{step.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{step.text}</p></li>
            ))}
          </ol>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
          <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-18">
            <div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full bg-solar/15 blur-3xl" />
            <div className="relative mx-auto max-w-2xl"><h2 className="font-heading text-4xl font-semibold tracking-[-0.045em] text-balance">Ready to understand your solar future?</h2><p className="mt-4 text-lg leading-8 text-primary-foreground/70">Create your account now. The next setup step will build your first simulated site.</p><Link className={cn(buttonVariants({ size: "lg" }), "mt-8 h-12 bg-solar px-6 text-[#342400] hover:bg-solar/90")} href="/sign-up">Create your Aelora account <ArrowRight aria-hidden="true" /></Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <AeloraMark />
          <p className="text-sm text-muted-foreground">Intelligent solar monitoring, designed in Sri Lanka.</p>
          <div className="flex gap-5 text-sm"><Link className="hover:text-primary" href="/sign-in">Sign in</Link><Link className="hover:text-primary" href="/sign-up">Create account</Link></div>
        </div>
      </footer>
    </div>
  );
}

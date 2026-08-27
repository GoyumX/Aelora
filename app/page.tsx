import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  CloudSun,
  Cpu,
  Gauge,
  HousePlug,
  Radio,
  ShieldCheck,
  SunMedium,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AeloraMark } from "@/components/brand/aelora-mark";

import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Solar intelligence for every day",
  description:
    "Aelora turns site telemetry, local weather, and AI forecasts into one clear solar-energy workspace.",
};

const liveMetrics = [
  { label: "Solar", value: "4.82 kW", icon: SunMedium, tone: "text-[#ffbd45]" },
  { label: "Home", value: "2.31 kW", icon: HousePlug, tone: "text-[#62b8ff]" },
  { label: "Battery", value: "+1.06 kW", icon: BatteryCharging, tone: "text-[#8be39d]" },
  { label: "Grid export", value: "1.45 kW", icon: Zap, tone: "text-[#f4f0e8]" },
];

const forecastDays = [
  { day: "MON", energy: "23.8", height: 78 },
  { day: "TUE", energy: "25.1", height: 88 },
  { day: "WED", energy: "18.4", height: 52 },
  { day: "THU", energy: "14.9", height: 36 },
  { day: "FRI", energy: "20.6", height: 63 },
  { day: "SAT", energy: "24.2", height: 81 },
  { day: "SUN", energy: "24.7", height: 85 },
];

function EnergyCurve() {
  return (
    <svg
      aria-label="Today’s generation and household demand curve"
      className="h-auto w-full overflow-visible"
      role="img"
      viewBox="0 0 720 270"
    >
      <desc>
        Solar generation rises from sunrise toward midday while household demand remains lower and steadier.
      </desc>
      <defs>
        <linearGradient id="solar-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffbd45" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffbd45" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[36, 92, 148, 204].map((y) => (
        <line key={y} stroke="rgba(244,240,232,.11)" strokeWidth="1" x1="32" x2="704" y1={y} y2={y} />
      ))}
      <path
        d="M32 220 C84 220, 104 218, 136 197 C188 164, 214 103, 276 67 C330 35, 394 34, 450 58 C506 81, 536 130, 580 171 C616 204, 653 218, 704 220 L704 236 L32 236 Z"
        fill="url(#solar-area)"
      />
      <path
        d="M32 220 C84 220, 104 218, 136 197 C188 164, 214 103, 276 67 C330 35, 394 34, 450 58 C506 81, 536 130, 580 171 C616 204, 653 218, 704 220"
        fill="none"
        stroke="#ffbd45"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M32 190 C92 177, 129 184, 173 174 C231 160, 271 184, 329 170 C389 156, 431 180, 486 165 C544 149, 590 175, 646 159 C670 152, 688 156, 704 150"
        fill="none"
        stroke="#62b8ff"
        strokeDasharray="8 9"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="450" cy="58" fill="#ffbd45" r="6" />
      <circle cx="450" cy="58" fill="none" opacity=".4" r="12" stroke="#ffbd45" />
      <text fill="rgba(244,240,232,.48)" fontFamily="monospace" fontSize="12" x="32" y="258">06:00</text>
      <text fill="rgba(244,240,232,.48)" fontFamily="monospace" fontSize="12" textAnchor="middle" x="366" y="258">12:00</text>
      <text fill="rgba(244,240,232,.48)" fontFamily="monospace" fontSize="12" textAnchor="end" x="704" y="258">18:00</text>
      <text fill="#ffbd45" fontFamily="monospace" fontSize="12" x="468" y="51">4.82 kW now</text>
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-dvh overflow-hidden bg-[#090b0c] text-[#f4f0e8] selection:bg-[#ffbd45] selection:text-[#17120a]">
      <a
        className="fixed left-4 top-3 z-50 -translate-y-24 rounded-full bg-[#ffbd45] px-5 py-3 text-sm font-semibold text-[#17120a] shadow-xl transition-transform duration-200 focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="absolute inset-x-0 top-0 z-40 border-b border-white/10">
        <nav aria-label="Public navigation" className="mx-auto flex h-20 max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbd45]" href="/">
            <AeloraMark className="[&>span:first-child]:bg-[#ffbd45]/12 [&>span:first-child]:text-[#ffbd45] [&>span:first-child]:ring-[#ffbd45]/25 [&>span:last-child]:text-[#f4f0e8]" />
          </Link>
          <div className="hidden items-center gap-8 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-white/55 md:flex">
            <a className="transition-colors duration-200 hover:text-white" href="#observe">Observe</a>
            <a className="transition-colors duration-200 hover:text-white" href="#forecast">Forecast</a>
            <a className="transition-colors duration-200 hover:text-white" href="#digital-twin">Digital twin</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white/75 transition-colors duration-200 hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbd45]" href="/sign-in">Sign in</Link>
            <Link className="hidden min-h-11 items-center gap-2 rounded-full bg-[#f4f0e8] px-5 text-sm font-semibold text-[#111314] transition-colors duration-200 hover:bg-[#ffbd45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbd45] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b0c] sm:inline-flex" href="/sign-up">
              Create account <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className={`relative border-b border-white/10 pt-20 ${styles.heroGrid}`}>
          <div aria-hidden="true" className={styles.ambientGlow} />
          <div className="relative mx-auto grid min-h-[48rem] max-w-[90rem] gap-16 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12 lg:px-12 lg:py-28">
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-3 font-mono text-[0.68rem] uppercase tracking-[0.2em] text-white/50">
                <span className="relative flex size-2">
                  <span className={`absolute inline-flex size-full rounded-full bg-[#8be39d] opacity-70 ${styles.livePulse}`} />
                  <span className="relative inline-flex size-2 rounded-full bg-[#8be39d]" />
                </span>
                Solar intelligence / Colombo, LK
              </div>
              <h1 className="mt-8 max-w-[11ch] font-heading text-[clamp(4rem,8vw,7.8rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-balance">
                Read the sun. <span className="text-[#ffbd45]">Run the day.</span>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-white/62 sm:text-xl">Aelora turns live site telemetry, local weather, and a seven-day AI forecast into one precise energy view.</p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ffbd45] px-6 text-sm font-semibold text-[#17120a] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#ffd071] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b0c]" href="/sign-up">
                  Create your site <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/18 px-6 text-sm font-semibold text-white transition-[border-color,background-color] duration-200 hover:border-white/35 hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbd45]" href="/sign-in">Open your workspace</Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-3xl lg:translate-x-5">
              <div aria-hidden="true" className={styles.solarOrbit}><span className={styles.orbitDot} /></div>
              <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#111416]/92 p-5 shadow-[0_40px_100px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-6">
                  <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/42"><Radio aria-hidden="true" className="size-3.5 text-[#8be39d]" /> Live site</div><p className="mt-2 text-lg font-semibold">Colombo Home</p></div>
                  <div className="text-right"><p className="font-mono text-xs text-white/40">UPDATED 11:42</p><p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#8be39d]/10 px-3 py-1 text-xs font-semibold text-[#8be39d]"><span className="size-1.5 rounded-full bg-current" /> All systems online</p></div>
                </div>
                <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
                  {liveMetrics.map(({ label, value, icon: Icon, tone }, index) => (
                    <div className={`py-5 ${index % 2 === 0 ? "pr-4" : "pl-4"} sm:px-4 sm:first:pl-0 sm:last:pr-0`} key={label}>
                      <div className="flex items-center gap-2 text-xs text-white/40"><Icon aria-hidden="true" className={`size-3.5 ${tone}`} /> {label}</div>
                      <p className="mt-2 font-mono text-base font-semibold sm:text-lg">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-6">
                  <div className="mb-2 flex items-center justify-between gap-4"><p className="text-sm font-semibold">Generation vs demand</p><div className="flex gap-4 text-[0.68rem] text-white/44"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#ffbd45]" /> Solar</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#62b8ff]" /> Home</span></div></div>
                  <EnergyCurve />
                </div>
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10">
            <div className="mx-auto grid max-w-[90rem] divide-y divide-white/10 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
              {[
                ["01", "Observe", "Every device and energy flow, in context."],
                ["02", "Anticipate", "Weather-aware forecasts for the next seven days."],
                ["03", "Act", "Explainable alerts before small losses become large ones."],
              ].map(([number, title, text]) => (
                <div className="grid grid-cols-[2.5rem_1fr] gap-3 py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0" key={number}><span className="font-mono text-xs text-[#ffbd45]">{number}</span><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-white/45">{text}</p></div></div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f2efe7] text-[#111314]" id="observe">
          <div className="mx-auto max-w-[90rem] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="grid gap-12 border-b border-black/15 pb-16 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-black/65">01 / Live system</p>
              <h2 className="max-w-4xl font-heading text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">Observe the system as it moves.</h2>
            </div>
            <div className="grid gap-10 pt-16 lg:grid-cols-[1.2fr_.8fr] lg:items-start">
              <div className="relative min-h-[31rem] overflow-hidden rounded-[1.75rem] bg-[#101315] p-6 text-[#f4f0e8] sm:p-8">
                <div className="flex items-center justify-between gap-5"><div><p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/65">Energy flow now</p><p className="mt-2 text-xl font-semibold">Midday surplus</p></div><span className="rounded-full border border-[#8be39d]/25 bg-[#8be39d]/8 px-3 py-1.5 text-xs font-semibold text-[#8be39d]">Healthy</span></div>
                <div className="mt-14 grid grid-cols-3 items-center gap-3 sm:gap-5">
                  {[
                    [SunMedium, "Solar", "4.82 kW", "text-[#ffbd45]"],
                    [HousePlug, "Home", "2.31 kW", "text-[#62b8ff]"],
                    [BatteryCharging, "Battery", "76%", "text-[#8be39d]"],
                  ].map(([Icon, label, value, tone]) => (
                    <div className="flex min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5" key={label as string}>
                      <Icon aria-hidden="true" className={`size-6 ${tone as string}`} />
                      <div><p className="text-xs text-white/65">{label as string}</p><p className="mt-1 font-mono text-base font-semibold sm:text-xl">{value as string}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between gap-5 border-t border-white/10 pt-6"><p className="max-w-md text-sm leading-6 text-white/50">Generation is covering the home, charging the battery, and exporting the remaining 1.45 kW.</p><Gauge aria-hidden="true" className="size-8 text-[#ffbd45]" /></div>
              </div>
              <div className="lg:pl-8">
                <p className="max-w-lg text-xl leading-8 text-black/62">See generation, household demand, battery state, grid exchange, weather, and device freshness without translating raw telemetry yourself.</p>
                <dl className="mt-12 divide-y divide-black/15 border-y border-black/15">
                  {[["30 sec", "Gateway telemetry cadence"], ["Live", "Device online and freshness status"], ["1 view", "Solar, home, battery, and grid context"]].map(([value, label]) => (
                    <div className="grid grid-cols-[7rem_1fr] gap-5 py-5" key={label}><dt className="font-mono text-lg font-semibold">{value}</dt><dd className="text-sm leading-6 text-black/65">{label}</dd></div>
                  ))}
                </dl>
                <Link className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-black pb-1 text-sm font-semibold transition-colors duration-200 hover:border-[#d18d00] hover:text-[#9b6700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d78bd]" href="/sign-in">Explore the live workspace <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-white/10 bg-[#090b0c]" id="forecast">
          <div className="mx-auto grid max-w-[90rem] gap-16 px-5 py-24 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-12 lg:py-32">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#62b8ff]">02 / AI forecast</p>
              <p aria-hidden="true" className="mt-8 font-mono text-[7rem] font-semibold leading-none tracking-[-0.09em] text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,.16)] sm:text-[10rem]">07</p>
              <h2 className="-mt-8 max-w-xl font-heading text-4xl font-semibold leading-[1] tracking-[-0.055em] text-balance sm:text-6xl">Seven days, translated into decisions.</h2>
              <p className="mt-7 max-w-lg text-lg leading-8 text-white/55">Aelora combines the latest site history with location-aware weather, then shows what the model expects and how confident it is.</p>
              <div className="mt-9 flex flex-wrap gap-3 text-xs font-semibold text-white/55"><span className="rounded-full border border-white/12 px-3 py-2">Weather refreshed</span><span className="rounded-full border border-white/12 px-3 py-2">Model online</span><span className="rounded-full border border-white/12 px-3 py-2">Updated 11:00</span></div>
            </div>
            <div className="rounded-[1.75rem] border border-white/12 bg-white/[.035] p-5 sm:p-8">
              <div className="flex items-end justify-between gap-5 border-b border-white/10 pb-7"><div><p className="text-sm text-white/65">Expected this week</p><p className="mt-2 font-mono text-3xl font-semibold sm:text-4xl">151.7 <span className="text-base font-normal text-white/60">kWh</span></p></div><div className="text-right"><p className="text-xs text-white/60">Confidence</p><p className="mt-1 font-mono font-semibold text-[#8be39d]">87%</p></div></div>
              <div className="mt-8 grid h-64 grid-cols-7 items-end gap-2 sm:gap-4">
                {forecastDays.map((item) => (
                  <div className="flex h-full flex-col justify-end" key={item.day}><p className="mb-2 hidden text-center font-mono text-[0.65rem] text-white/45 sm:block">{item.energy}</p><div className="relative flex-1"><div className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-[#d27c00] to-[#ffbd45]" style={{ height: `${item.height}%` }} /></div><p className="mt-3 text-center font-mono text-[0.62rem] font-semibold text-white/50">{item.day}</p></div>
                ))}
              </div>
              <div className="mt-7 flex items-center justify-between gap-5 border-t border-white/10 pt-6"><div className="flex items-center gap-3"><CloudSun aria-hidden="true" className="size-5 text-[#62b8ff]" /><p className="text-sm text-white/50">Cloud cover reduces Wednesday’s expected yield.</p></div><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-white/35" /></div>
            </div>
          </div>
        </section>

        <section className="bg-[#ffbd45] text-[#17120a]" id="digital-twin">
          <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end lg:px-12 lg:py-28">
            <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-black/70">03 / Virtual site gateway</p><h2 className="mt-8 max-w-4xl font-heading text-5xl font-semibold leading-[0.92] tracking-[-0.065em] text-balance sm:text-7xl lg:text-8xl">Hardware can come later.</h2></div>
            <div><p className="text-lg leading-8 text-black/62">Build a virtual panel array, inverter, battery, and grid connection. Change the weather, load, and equipment state; Aelora receives the same telemetry contract a real gateway can use later.</p><div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/20 bg-black/20">
              {[[Cpu, "Real protocol"], [Radio, "Online status"], [ShieldCheck, "Signed requests"], [Zap, "Live scenarios"]].map(([Icon, label]) => (
                <div className="flex items-center gap-3 bg-[#ffbd45] p-4" key={label as string}><Icon aria-hidden="true" className="size-4.5" /><span className="text-sm font-semibold">{label as string}</span></div>
              ))}
            </div></div>
          </div>
        </section>

        <section className="bg-[#f2efe7] px-5 py-24 text-[#111314] sm:px-8 lg:px-12 lg:py-32">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-12 border-t border-black/15 pt-10 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-black/65">Your solar system, made legible</p><h2 className="mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-balance sm:text-7xl">See today clearly. Prepare for tomorrow.</h2></div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col"><Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111314] px-6 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#273035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d78bd]" href="/sign-up">Create your account <ArrowRight aria-hidden="true" className="size-4" /></Link><Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/20 px-6 text-sm font-semibold transition-colors duration-200 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d78bd]" href="/sign-in">Sign in</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#090b0c]">
        <div className="mx-auto grid max-w-[90rem] gap-8 px-5 py-10 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8 lg:px-12">
          <div><AeloraMark className="[&>span:first-child]:bg-[#ffbd45]/12 [&>span:first-child]:text-[#ffbd45] [&>span:first-child]:ring-[#ffbd45]/25 [&>span:last-child]:text-[#f4f0e8]" /><p className="mt-4 max-w-md text-sm leading-6 text-white/65">Monitoring, forecasting, and system clarity for residential solar sites.</p></div>
          <div className="sm:text-right"><p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/60">Designed and built in Sri Lanka</p><p className="mt-3 text-xs text-white/60">© 2026 Aelora</p></div>
        </div>
      </footer>
    </div>
  );
}

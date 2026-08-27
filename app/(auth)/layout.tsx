import { Activity, CloudSun, Radio, SunMedium } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AeloraMark } from "@/components/brand/aelora-mark";

import styles from "./auth-shell.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-[#090b0c] lg:grid-cols-[minmax(0,1.12fr)_minmax(31rem,.88fr)]">
      <section className={`relative hidden min-h-dvh overflow-hidden border-r border-white/10 px-10 py-9 text-[#f4f0e8] lg:flex lg:flex-col ${styles.grid}`} aria-label="Aelora product overview">
        <div aria-hidden="true" className={styles.glow} />
        <Link className="relative z-10 w-fit rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbd45]" href="/">
          <AeloraMark className="[&>span:first-child]:bg-[#ffbd45]/12 [&>span:first-child]:text-[#ffbd45] [&>span:first-child]:ring-[#ffbd45]/25 [&>span:last-child]:text-[#f4f0e8]" />
        </Link>

        <div className="relative z-10 my-auto grid gap-10 xl:grid-cols-[.86fr_1.14fr] xl:items-center">
          <div className="max-w-lg">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#ffbd45]">A clearer energy day</p>
            <h2 className="mt-6 font-heading text-5xl font-semibold leading-[0.92] tracking-[-0.065em] text-balance xl:text-7xl">Solar intelligence, without the noise.</h2>
            <p className="mt-7 max-w-md text-base leading-7 text-white/48">One place to see what your site is doing now, what the weather changes next, and where performance needs attention.</p>
          </div>

          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/12 bg-[#111416]/88 p-6 shadow-[0_36px_90px_rgba(0,0,0,.48)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div><div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-white/38"><Radio aria-hidden="true" className="size-3.5 text-[#8be39d]" /> Live site</div><p className="mt-2 font-semibold">Colombo Home</p></div>
              <span className="rounded-full bg-[#8be39d]/10 px-3 py-1 text-[0.68rem] font-semibold text-[#8be39d]">Online</span>
            </div>
            <div className="py-7">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs text-white/38">Solar output</p><p className="mt-2 font-mono text-4xl font-semibold">4.82 <span className="text-base font-normal text-white/35">kW</span></p></div><SunMedium aria-hidden="true" className="size-9 text-[#ffbd45]" /></div>
              <div className="mt-8 flex h-28 items-end gap-1.5" aria-hidden="true">
                {[16, 24, 35, 52, 69, 84, 96, 88, 76, 58, 39, 24].map((height, index) => <span className="flex-1 rounded-t-sm bg-gradient-to-t from-[#c87900] to-[#ffbd45]" key={`${height}-${index}`} style={{ height: `${height}%` }} />)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
              <div><p className="flex items-center gap-2 text-xs text-white/35"><Activity aria-hidden="true" className="size-3.5 text-[#62b8ff]" /> Home demand</p><p className="mt-2 font-mono font-semibold">2.31 kW</p></div>
              <div><p className="flex items-center gap-2 text-xs text-white/35"><CloudSun aria-hidden="true" className="size-3.5 text-[#62b8ff]" /> Today</p><p className="mt-2 font-mono font-semibold">Mostly clear</p></div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 pt-5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-white/30">
          <span>Monitor / Forecast / Explain</span><span>Colombo · Sri Lanka</span>
        </div>
      </section>

      <section className="relative flex min-h-dvh items-center justify-center bg-[#f2efe7] px-5 py-16 sm:px-10 lg:px-12">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-black/10" />
        {children}
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.62rem] uppercase tracking-[0.15em] text-black/58 lg:left-auto lg:right-8 lg:translate-x-0">Protected, site-scoped access</p>
      </section>
    </main>
  );
}

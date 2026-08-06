import type { ReactNode } from "react";
import { Leaf, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";

const benefits = [
  { icon: Sparkles, text: "AI-assisted generation forecasts" },
  { icon: Leaf, text: "Clear solar performance insights" },
  { icon: ShieldCheck, text: "Private, site-scoped monitoring" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(30rem,0.8fr)]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-end">
        <Image alt="" className="object-cover" fill priority sizes="55vw" src="/images/aelora-auth-energy.png" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#102d2e] via-[#102d2e]/62 to-[#102d2e]/10" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#102d2e]/45 to-transparent" />
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">Solar intelligence</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.045em] text-balance xl:text-5xl">Understand your energy. Anticipate what comes next.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-primary-foreground/75">Aelora brings monitoring, forecasting, and system health into one calm workspace.</p>
          <ul className="mt-9 grid gap-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li className="flex items-center gap-3 text-sm font-medium" key={text}>
                <span className="grid size-9 place-items-center rounded-xl bg-white/10"><Icon aria-hidden="true" className="size-4.5" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-8">{children}</section>
    </main>
  );
}

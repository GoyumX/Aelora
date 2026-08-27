import Link from "next/link";
import type { ReactNode } from "react";

import { AeloraMark } from "@/components/brand/aelora-mark";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-[27rem] text-[#111314] [&_button[type=submit]]:h-12 [&_button[type=submit]]:rounded-xl [&_button[type=submit]]:bg-[#111314] [&_button[type=submit]]:text-white [&_button[type=submit]]:shadow-none [&_button[type=submit]]:transition-[background-color,transform] [&_button[type=submit]]:duration-200 [&_button[type=submit]]:hover:-translate-y-0.5 [&_button[type=submit]]:hover:bg-[#283034] [&_input]:h-12 [&_input]:rounded-xl [&_input]:border-black/15 [&_input]:bg-white/72 [&_input]:text-[#111314] [&_input]:shadow-none [&_input]:placeholder:text-black/30 [&_label]:text-[#111314]">
      <Link className="mb-10 inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d78bd] lg:hidden" href="/">
        <AeloraMark className="[&>span:first-child]:bg-[#ffbd45]/18 [&>span:first-child]:text-[#9b6700] [&>span:first-child]:ring-[#ffbd45]/35 [&>span:last-child]:text-[#111314]" />
      </Link>
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-black/65">Secure workspace access</p>
      <h1 className="mt-5 font-heading text-4xl font-semibold leading-none tracking-[-0.055em] sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-sm text-base leading-7 text-black/65">{description}</p>
      <div className="mt-9">{children}</div>
      <div className="mt-8 border-t border-black/12 pt-6 text-sm text-black/65">{footer}</div>
    </div>
  );
}

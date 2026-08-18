import { SunMedium } from "lucide-react";

import { cn } from "@/lib/utils";

type AeloraMarkProps = {
  compact?: boolean;
  className?: string;
};

export function AeloraMark({ compact = false, className }: AeloraMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-solar/15 text-solar-strong ring-1 ring-solar/25">
        <SunMedium aria-hidden="true" className="size-5" strokeWidth={2.25} />
      </span>
      {!compact && (
        <span className="font-heading text-lg font-semibold tracking-[-0.025em] text-foreground">
          Aelora
        </span>
      )}
    </span>
  );
}


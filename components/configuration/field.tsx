import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfigurationField({ label, hint, ...props }: ComponentProps<typeof Input> & { label: string; hint?: ReactNode }) {
  const id = props.id ?? props.name;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input {...props} id={id} />{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}</div>;
}

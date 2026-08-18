import Link from "next/link";
import type { ReactNode } from "react";

import { AeloraMark } from "@/components/brand/aelora-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <Link className="mb-7 inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/">
        <AeloraMark />
      </Link>
      <Card className="border-border/80 shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-[-0.03em]">{title}</CardTitle>
          <CardDescription className="leading-6">{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
    </div>
  );
}

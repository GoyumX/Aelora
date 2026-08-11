import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description: string;
  eyebrow: string;
};

const foundationAreas = [
  { title: "Interface foundation", description: "Responsive shell, theme support, and reusable components are connected." },
  { title: "Data integration", description: "Live and synthetic solar data will be connected in the upcoming data phase." },
  { title: "Feature delivery", description: "This route is ready for its focused dashboard and workflow implementation." },
];

export function PagePlaceholder({ title, description, eyebrow }: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <section aria-labelledby="page-title" className="max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <Badge className="gap-1.5 border-energy/25 bg-energy/10 text-energy-strong" variant="outline">
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Foundation ready
          </Badge>
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl" id="page-title">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
      </section>

      <section aria-label={`${title} implementation status`} className="grid gap-4 md:grid-cols-3">
        {foundationAreas.map((area, index) => (
          <Card className="overflow-hidden border-border/80 shadow-xs" key={area.title}>
            <div aria-hidden="true" className={index === 0 ? "h-1 bg-primary" : index === 1 ? "h-1 bg-energy" : "h-1 bg-solar"} />
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base">{area.title}</CardTitle>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </div>
              <CardDescription className="leading-6">{area.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-2 rounded-full bg-muted"><div className="h-full w-1/3 rounded-full bg-primary/35" /></div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

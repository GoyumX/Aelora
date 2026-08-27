"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type InteractivePowerPoint = {
  id: string;
  dateTime: string;
  axisLabel: string;
  tooltipLabel: string;
  generation: number;
  consumption: number | null;
  generationLower?: number | null;
  generationUpper?: number | null;
  breakBefore?: boolean;
};

type AxisTick = { label: string; position: number };

const width = 720;
const height = 280;
const plot = { left: 64, right: 670, top: 48, bottom: 210 };

function valueLabel(value: number | null, unit: string, decimals: number) {
  return value == null ? "Unavailable" : `${value.toFixed(decimals)} ${unit}`;
}

export function InteractivePowerChart({
  ariaLabel,
  axisTicks,
  decimals = 2,
  description,
  domain,
  points,
  seriesLabels,
  tooltipAxisLabel = "Time",
  unit,
  xAxisLabel,
  yAxisLabel = `Power (${unit})`,
}: {
  ariaLabel: string;
  axisTicks?: AxisTick[];
  decimals?: number;
  description: string;
  domain?: { startAt: string; endAt: string };
  points: InteractivePowerPoint[];
  seriesLabels: { generation: string; consumption: string };
  tooltipAxisLabel?: string;
  unit: string;
  xAxisLabel: string;
  yAxisLabel?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.generation, point.consumption ?? 0, point.generationUpper ?? 0]),
  );
  const domainStart = domain ? new Date(domain.startAt).getTime() : null;
  const domainDuration = domainStart == null ? null : Math.max(1, new Date(domain!.endAt).getTime() - domainStart);
  const xAt = (point: InteractivePowerPoint, index: number) => {
    const ratio = domainStart == null || domainDuration == null
      ? (points.length === 1 ? 0.5 : index / Math.max(1, points.length - 1))
      : Math.max(0, Math.min(1, (new Date(point.dateTime).getTime() - domainStart) / domainDuration));
    return plot.left + ratio * (plot.right - plot.left);
  };
  const yAt = (value: number) => plot.bottom - value / maximum * (plot.bottom - plot.top);
  const lineSegments = (selector: (point: InteractivePowerPoint) => number | null | undefined) => {
    const segments: string[] = [];
    let current: string[] = [];
    points.forEach((point, index) => {
      const value = selector(point);
      if (point.breakBefore || value == null) {
        if (current.length) segments.push(current.join(" "));
        current = [];
      }
      if (value != null) current.push(`${xAt(point, index)},${yAt(value)}`);
    });
    if (current.length) segments.push(current.join(" "));
    return segments;
  };
  const ticks = axisTicks ?? (points.length ? [
    { label: points[0].axisLabel, position: 0 },
    { label: points[Math.floor((points.length - 1) / 2)].axisLabel, position: 0.5 },
    { label: points.at(-1)!.axisLabel, position: 1 },
  ] : []);
  const selected = selectedIndex == null ? null : points[selectedIndex];
  const selectedX = selected && selectedIndex != null ? xAt(selected, selectedIndex) : null;
  const selectedY = selected ? Math.min(yAt(selected.generation), yAt(selected.consumption ?? selected.generation)) : null;
  const hasConsumption = points.some((point) => point.consumption != null);
  const hasEnvelope = points.some((point) => point.generationLower != null && point.generationUpper != null);
  const explorerIndex = selectedIndex ?? 0;
  const explorerPoint = points[explorerIndex];
  const explorerValue = explorerPoint
    ? `${explorerPoint.tooltipLabel}: ${seriesLabels.generation} ${valueLabel(explorerPoint.generation, unit, decimals)}, ${seriesLabels.consumption} ${valueLabel(explorerPoint.consumption, unit, decimals)}`
    : "No chart data";

  return (
    <div className="relative" onMouseLeave={() => setSelectedIndex(null)}>
      <svg aria-label={ariaLabel} className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        <title>{ariaLabel}</title>
        <desc>{description} Hover or focus a point to read its exact time and values.</desc>
        {[plot.top, 102, 156, plot.bottom].map((y) => <line className="stroke-border" key={y} x1={plot.left} x2={plot.right} y1={y} y2={y} />)}
        <line className="stroke-border" x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} />
        <text className="fill-muted-foreground text-[11px]" textAnchor="end" x="55" y="214">0</text>
        <text className="fill-muted-foreground text-[11px]" textAnchor="end" x="55" y="133">{(maximum / 2).toFixed(1)}</text>
        <text className="fill-muted-foreground text-[11px]" textAnchor="end" x="55" y="52">{maximum.toFixed(1)}</text>
        {hasEnvelope ? <>
          {lineSegments((point) => point.generationUpper).map((segment, index) => <polyline className="fill-none stroke-solar-strong/60 [stroke-width:1.5]" key={`upper-${index}`} points={segment} strokeDasharray="4 5" />)}
          {lineSegments((point) => point.generationLower).map((segment, index) => <polyline className="fill-none stroke-solar-strong/60 [stroke-width:1.5]" key={`lower-${index}`} points={segment} strokeDasharray="4 5" />)}
        </> : null}
        {lineSegments((point) => point.generation).map((segment, index) => <polyline className="fill-none stroke-solar [stroke-width:4]" key={`generation-${index}`} points={segment} strokeLinecap="round" strokeLinejoin="round" />)}
        {hasConsumption ? lineSegments((point) => point.consumption).map((segment, index) => <polyline className="fill-none stroke-primary [stroke-width:3]" key={`consumption-${index}`} points={segment} strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />) : null}
        {selectedX != null ? <line className="stroke-foreground/35" strokeDasharray="3 4" x1={selectedX} x2={selectedX} y1={plot.top} y2={plot.bottom} /> : null}
        {selected && selectedX != null ? <>
          <circle className="fill-solar stroke-background [stroke-width:3]" cx={selectedX} cy={yAt(selected.generation)} r="6" />
          {selected.consumption != null ? <circle className="fill-primary stroke-background [stroke-width:3]" cx={selectedX} cy={yAt(selected.consumption)} r="5" /> : null}
        </> : null}
        {ticks.map((tick, index) => <text className="fill-muted-foreground text-[11px]" key={`${tick.position}-${tick.label}`} textAnchor={index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"} x={plot.left + tick.position * (plot.right - plot.left)} y="232">{tick.label}</text>)}
        <text className="fill-muted-foreground text-[11px] font-medium" textAnchor="middle" transform="rotate(-90 15 129)" x="15" y="129">{yAxisLabel}</text>
        <text className="fill-muted-foreground text-[11px] font-medium" textAnchor="middle" x="367" y="266">{xAxisLabel}</text>
      </svg>

      {points.length ? <div
        aria-label={`${ariaLabel} data explorer`}
        aria-valuemax={points.length}
        aria-valuemin={1}
        aria-valuenow={explorerIndex + 1}
        aria-valuetext={explorerValue}
        className="absolute cursor-crosshair rounded-md bg-transparent outline-none focus-visible:bg-primary/8 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
        onBlur={() => setSelectedIndex(null)}
        onFocus={() => setSelectedIndex((current) => current ?? 0)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((current) => Math.max(0, (current ?? 0) - 1));
          } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((current) => Math.min(points.length - 1, (current ?? 0) + 1));
          } else if (event.key === "Home") {
            event.preventDefault();
            setSelectedIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setSelectedIndex(points.length - 1);
          }
        }}
        onMouseEnter={() => setSelectedIndex((current) => current ?? 0)}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (bounds.width <= 0) return;
          const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
          const targetX = plot.left + ratio * (plot.right - plot.left);
          const nearest = points.reduce((best, point, index) => (
            Math.abs(xAt(point, index) - targetX) < Math.abs(xAt(points[best], best) - targetX) ? index : best
          ), 0);
          setSelectedIndex(nearest);
        }}
        role="slider"
        style={{
          height: `${(plot.bottom - plot.top) / height * 100}%`,
          left: `${plot.left / width * 100}%`,
          top: `${plot.top / height * 100}%`,
          width: `${(plot.right - plot.left) / width * 100}%`,
        }}
        tabIndex={0}
      /> : null}

      {selected && selectedX != null && selectedY != null ? <div
        className={cn(
          "pointer-events-none absolute z-10 min-w-48 rounded-xl border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-sm",
          selectedX > width * 0.72 ? "-translate-x-full" : "-translate-x-1/2",
        )}
        role="status"
        style={{ left: `${selectedX / width * 100}%`, top: `${Math.max(2, (selectedY - 46) / height * 100)}%` }}
      >
        <p className="text-xs font-semibold"><span className="mr-1 font-normal text-muted-foreground">{tooltipAxisLabel}</span>{selected.tooltipLabel}</p>
        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full bg-solar" />{seriesLabels.generation}</span><strong className="text-right">{valueLabel(selected.generation, unit, decimals)}</strong>
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full bg-primary" />{seriesLabels.consumption}</span><strong className="text-right">{valueLabel(selected.consumption, unit, decimals)}</strong>
        </div>
      </div> : null}
    </div>
  );
}

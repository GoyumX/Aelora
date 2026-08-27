import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { ReportSnapshot } from "@/lib/reports/report";

export async function reportSnapshotToPdf(report: ReportSnapshot) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595.28, 841.89]);
  const navy = rgb(0.05, 0.12, 0.22);
  const blue = rgb(0.12, 0.42, 0.86);
  const muted = rgb(0.35, 0.40, 0.48);
  let y = 790;
  const text = (value: string, size = 10, options: { bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    page.drawText(value, { x: options.x ?? 48, y, size, font: options.bold ? bold : regular, color: options.color ?? navy });
    y -= size + 8;
  };
  const metric = (label: string, value: string, x: number, top: number) => {
    page.drawRectangle({ x, y: top - 54, width: 150, height: 58, borderColor: rgb(0.82, 0.86, 0.92), borderWidth: 1, color: rgb(0.97, 0.98, 1) });
    page.drawText(label, { x: x + 10, y: top - 18, size: 8, font: regular, color: muted });
    page.drawText(value, { x: x + 10, y: top - 42, size: 16, font: bold, color: navy });
  };

  text("AELORA", 11, { bold: true, color: blue });
  text(`${report.period.type === "WEEKLY" ? "Weekly" : "Monthly"} solar report`, 24, { bold: true });
  text(`${report.site.name} · ${report.period.label}`, 11, { color: muted });
  text(`Generated ${new Date(report.generatedAt).toISOString()} · ${report.provenance.sourceLabel}`, 8, { color: muted });
  y -= 10;
  metric("Solar generation", `${report.energy.generationKwh.toFixed(1)} kWh`, 48, y);
  metric("Home consumption", `${report.energy.consumptionKwh.toFixed(1)} kWh`, 210, y);
  metric("Self sufficiency", `${report.energy.selfSufficiencyPct.toFixed(1)}%`, 372, y);
  y -= 82;
  text("Energy balance", 14, { bold: true });
  text(`Grid import ${report.energy.gridImportKwh.toFixed(1)} kWh    Grid export ${report.energy.gridExportKwh.toFixed(1)} kWh`);
  text(`Battery charged ${report.energy.batteryChargeKwh.toFixed(1)} kWh    discharged ${report.energy.batteryDischargeKwh.toFixed(1)} kWh`);
  y -= 8;
  text("Performance and evidence", 14, { bold: true });
  const performanceRatio = report.performance.performanceRatioPct === null ? "insufficient evidence" : `${report.performance.performanceRatioPct.toFixed(1)}%`;
  text(`Expected production ${report.performance.expectedGenerationKwh.toFixed(1)} kWh    performance ratio ${performanceRatio}`);
  text(`Availability ${report.performance.availabilityPct.toFixed(1)}%    data completeness ${report.provenance.completenessPct.toFixed(1)}%`);
  text(`Forecast labels ${report.forecastAccuracy.sampleCount}    MAE ${report.forecastAccuracy.maeKwh?.toFixed(3) ?? "not available"} kWh    evidence ${report.forecastAccuracy.evidenceQuality}`);
  text(`Alerts ${report.alerts.total}    critical ${report.alerts.critical}    resolved ${report.alerts.resolved}    grid outage ${report.alerts.gridOutageMinutes.toFixed(1)} min`);
  y -= 8;
  text("Environmental estimate", 14, { bold: true });
  text(`${report.environmentalEstimate.avoidedCo2eKg.toFixed(1)} kg CO2e (illustrative ${report.environmentalEstimate.factorKgPerKwh} kg CO2e/kWh factor)`);
  y -= 8;
  text("Daily evidence", 14, { bold: true });
  text("Date          Generated     Consumed       Import          Export", 8, { bold: true });
  const visibleDays = report.period.type === "WEEKLY" ? 7 : 18;
  for (const point of report.daily.slice(0, visibleDays)) {
    text(`${point.date}    ${point.generationKwh.toFixed(1).padStart(7)} kWh    ${point.consumptionKwh.toFixed(1).padStart(7)} kWh    ${point.gridImportKwh.toFixed(1).padStart(7)} kWh    ${point.gridExportKwh.toFixed(1).padStart(7)} kWh`, 8);
  }
  if (report.daily.length > visibleDays) text(`The CSV download contains all ${report.daily.length} daily rows.`, 8, { color: muted });
  page.drawText("This immutable report is generated from stored telemetry. Simulated, estimated and measured evidence remain explicitly labelled.", { x: 48, y: 36, size: 7, font: regular, color: muted, maxWidth: 500 });
  return document.save();
}

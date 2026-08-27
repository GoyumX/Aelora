import { z } from "zod";

export type SupportArticle = {
  id: string;
  category: "GETTING_STARTED" | "SIMULATION" | "FORECAST" | "CONFIGURATION" | "ALERTS" | "REPORTS";
  title: string;
  summary: string;
  steps: string[];
  href: string;
};

export type SupportFaq = { id: string; question: string; answer: string };

export const supportArticles: SupportArticle[] = [
  { id: "getting-started", category: "GETTING_STARTED", title: "Getting started with Aelora", summary: "Move from a configured site to trustworthy monitoring in a few clear steps.", steps: ["Create or review the site location and timezone in System Configuration.", "Configure the panel arrays, inverter, and optional battery.", "Enroll and run the separate virtual or hardware edge gateway.", "Confirm fresh gateway and device timestamps in Live Monitoring before interpreting analytics."], href: "/system-configuration" },
  { id: "simulation-mode", category: "SIMULATION", title: "Understand Simulation Mode", summary: "Learn what the virtual gateway represents and what simulated evidence cannot prove.", steps: ["The separate Python gateway publishes through the same authenticated ingest contract as hardware.", "Stopping the virtual gateway stops fresh telemetry and eventually marks devices offline.", "Scenario controls change the virtual plant, not historical measured evidence.", "SIMULATED labels must remain visible in forecasts, alerts, analytics, and reports."], href: "/live-monitoring" },
  { id: "forecast-confidence", category: "FORECAST", title: "How forecasts and confidence ranges work", summary: "Read the 24-hour, 48-hour, seven-day, and monthly outlook without treating estimates as guarantees.", steps: ["Weather forecasts use the configured site's coordinates and timezone.", "The trained model estimates solar capacity factor, then Aelora scales it by installed capacity.", "Household demand is a separate load estimate and is never presented as measured future usage.", "Confidence ranges widen by horizon and appear only after enough completed verification labels exist."], href: "/ai-forecast" },
  { id: "configure-equipment", category: "CONFIGURATION", title: "Configure panels, inverter, and battery", summary: "Keep equipment capacity and operating limits aligned with the physical or virtual installation.", steps: ["Add each array with panel count, rated panel power, tilt, and azimuth.", "Set inverter AC rating, efficiency, adapter, and polling interval.", "Set usable battery capacity, charge/discharge power, state-of-charge limits, and reserve.", "Confirm the reporting gateway maps real device channels; passive panels are configured assets, not independently online devices."], href: "/system-configuration" },
  { id: "alert-troubleshooting", category: "ALERTS", title: "Troubleshoot alerts safely", summary: "Use evidence, timestamps, and connectivity state before taking action.", steps: ["Open the incident and inspect its exact evidence and provenance.", "Check gateway freshness before trusting downstream device-offline or PV performance claims.", "A power-cut alert requires sustained grid-voltage evidence; zero solar output alone is not a power cut.", "Acknowledge when investigating and resolve only when evidence has recovered or a reason is recorded."], href: "/alerts" },
  { id: "reports-analytics", category: "REPORTS", title: "Use analytics and reports", summary: "Understand deterministic historical totals and immutable report snapshots.", steps: ["Historical Analytics aggregates stored telemetry; it is not an AI prediction.", "Performance compares output with a transparent irradiance and capacity expectation.", "Weekly and monthly reports freeze the underlying evidence with a content hash.", "CSV contains detailed evidence while PDF provides a concise presentation summary."], href: "/reports" },
];

export const supportFaqs: SupportFaq[] = [
  { id: "panel-offline", question: "Why is a solar panel not shown as online?", answer: "Most passive panels do not communicate individually. Aelora shows connectivity only for a reporting string, MPPT, optimizer, microinverter, meter, inverter, battery, or gateway channel." },
  { id: "forecast-actual", question: "Is the AI forecast guaranteed generation?", answer: "No. It is a weather-conditioned estimate with model and horizon limitations. Completed measured telemetry is required to evaluate forecast accuracy." },
  { id: "confidence", question: "Why does my forecast not show a confidence range yet?", answer: "Aelora waits for enough completed, high-coverage verification labels. It does not invent an uncertainty band when calibration evidence is insufficient." },
  { id: "gateway-offline", question: "Why did my site become stale or offline?", answer: "The application received no recent heartbeat or telemetry. Confirm the gateway is running, publishing is enabled, credentials are valid, and the configured interval matches the producer." },
  { id: "historical-ai", question: "Is Historical Analytics AI-powered?", answer: "No. Historical Analytics deterministically aggregates stored telemetry. AI is used for forward solar forecasting, with its output stored separately and labelled." },
  { id: "weather", question: "Where does current weather come from?", answer: "Aelora stores Open-Meteo observations and issued forecast runs for the configured site coordinates. Dashboard rendering uses stored context and does not wait on the provider." },
  { id: "real-hardware", question: "Can I replace the virtual gateway with real equipment later?", answer: "Yes. A hardware adapter runs on the site network and normalizes vendor Modbus, SunSpec, or local API values into the same versioned telemetry envelope." },
  { id: "ticket-email", question: "Will a support ticket send an email?", answer: "Not currently. Tickets are stored locally in PostgreSQL for an Aelora administrator. Email delivery can be added later after outbound mail and privacy policies are configured." },
];

export const supportTicketCreateSchema = z.object({
  category: z.enum(["TECHNICAL", "ACCOUNT", "DATA_FORECAST", "FEATURE_REQUEST"]),
  priority: z.enum(["NORMAL", "HIGH"]),
  subject: z.string().trim().min(5, "Use a subject of at least 5 characters.").max(120),
  message: z.string().trim().min(20, "Describe the issue using at least 20 characters.").max(2000),
  siteId: z.string().min(1).max(100).nullable(),
}).strict();

export type SupportTicketCreate = z.infer<typeof supportTicketCreateSchema>;

export function searchSupportContent(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return { articles: supportArticles, faqs: supportFaqs };
  return {
    articles: supportArticles.filter((article) => [article.title, article.summary, ...article.steps].join(" ").toLocaleLowerCase().includes(normalized)),
    faqs: supportFaqs.filter((faq) => `${faq.question} ${faq.answer}`.toLocaleLowerCase().includes(normalized)),
  };
}

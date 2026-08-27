type UniqueConflict = {
  code?: unknown;
  meta?: { target?: unknown } | null;
};

export function isTelemetryTimestampConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const conflict = error as UniqueConflict;
  if (conflict.code !== "P2002") return false;
  const target = conflict.meta?.target;
  if (Array.isArray(target)) {
    const fields = new Set(target.filter((field): field is string => typeof field === "string"));
    return fields.has("siteId") && fields.has("source") && fields.has("observedAt");
  }
  return typeof target === "string"
    && target.includes("TelemetryReading")
    && target.includes("siteId")
    && target.includes("source")
    && target.includes("observedAt");
}

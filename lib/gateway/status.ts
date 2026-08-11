export const connectivityStatuses = ["NEVER_SEEN", "ONLINE", "STALE", "OFFLINE"] as const;
export type ConnectivityStatus = (typeof connectivityStatuses)[number];

/**
 * A link is healthy for two expected reporting intervals, stale until ten
 * intervals, and offline after that. The grace windows prevent a single
 * delayed packet from making equipment flap between online and offline.
 */
export function deriveConnectivityStatus(
  lastSeenAt: Date | null,
  expectedIntervalSec: number,
  now = new Date(),
): ConnectivityStatus {
  if (!lastSeenAt) return "NEVER_SEEN";

  const ageSeconds = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 1000);
  if (ageSeconds <= expectedIntervalSec * 2) return "ONLINE";
  if (ageSeconds <= expectedIntervalSec * 10) return "STALE";
  return "OFFLINE";
}

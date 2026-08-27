import { timingSafeEqual } from "node:crypto";

import { readBearerToken } from "@/lib/gateway/credentials";

function secretsEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes);
}

export function isWeatherSyncAuthorized(
  authorization: string | null,
  expectedSecret = process.env.WEATHER_SYNC_SECRET,
) {
  const actual = readBearerToken(authorization);
  return Boolean(actual && expectedSecret && secretsEqual(actual, expectedSecret));
}

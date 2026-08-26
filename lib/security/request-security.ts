export type MutationPolicy = {
  category: "browser" | "gateway" | "internal";
  maxRequests: number;
  windowMs: number;
  bodyLimitBytes: number;
  requireSameOrigin: boolean;
};

type InspectionResult =
  | { allowed: true; policy: MutationPolicy | null }
  | { allowed: false; policy: MutationPolicy; code: "cross_site_request" | "payload_too_large"; status: 403 | 413 };

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const browserPolicy: MutationPolicy = {
  category: "browser",
  maxRequests: 60,
  windowMs: 60_000,
  bodyLimitBytes: 256 * 1024,
  requireSameOrigin: true,
};

const gatewayPolicy: MutationPolicy = {
  category: "gateway",
  maxRequests: 180,
  windowMs: 60_000,
  bodyLimitBytes: 2 * 1024 * 1024,
  requireSameOrigin: false,
};

const internalPolicy: MutationPolicy = {
  category: "internal",
  maxRequests: 12,
  windowMs: 60_000,
  bodyLimitBytes: 64 * 1024,
  requireSameOrigin: false,
};

export function resolveMutationPolicy(pathname: string): MutationPolicy | null {
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth/")) return null;
  if (pathname.startsWith("/api/internal/")) return internalPolicy;
  if (pathname.startsWith("/api/v1/gateways/")) return gatewayPolicy;
  return browserPolicy;
}

function isSameOriginBrowserRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function inspectMutationRequest(request: Request): InspectionResult {
  if (safeMethods.has(request.method.toUpperCase())) return { allowed: true, policy: null };

  const policy = resolveMutationPolicy(new URL(request.url).pathname);
  if (!policy) return { allowed: true, policy: null };

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > policy.bodyLimitBytes) {
      return { allowed: false, policy, code: "payload_too_large", status: 413 };
    }
  }

  if (policy.requireSameOrigin && !isSameOriginBrowserRequest(request)) {
    return { allowed: false, policy, code: "cross_site_request", status: 403 };
  }

  return { allowed: true, policy };
}

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  consume(key: string, maxRequests: number, windowMs: number, now = Date.now()): RateLimitResult {
    const existing = this.entries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
        resetAt: entry.resetAt,
      };
    }

    entry.count += 1;
    this.entries.set(key, entry);
    this.removeExpiredEntries(now);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      retryAfterSeconds: 0,
      resetAt: entry.resetAt,
    };
  }

  private removeExpiredEntries(now: number) {
    if (this.entries.size < 2_000) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}

export const mutationRateLimiter = new FixedWindowRateLimiter();

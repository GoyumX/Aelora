import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRouteRedirect } from "@/lib/auth/route-access";
import { buildContentSecurityPolicy } from "@/lib/security/headers";
import { inspectMutationRequest, mutationRateLimiter } from "@/lib/security/request-security";

function clientIdentity(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local-client";
}

function secureApiMutation(request: NextRequest) {
  const inspection = inspectMutationRequest(request);
  if (!inspection.allowed) {
    const message = inspection.code === "payload_too_large"
      ? "The request body is larger than this endpoint accepts."
      : "Cross-site mutation requests are not accepted.";
    return NextResponse.json(
      { error: { code: inspection.code, message } },
      { status: inspection.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!inspection.policy) return NextResponse.next();

  const { category, maxRequests, windowMs } = inspection.policy;
  const result = mutationRateLimiter.consume(
    `${category}:${clientIdentity(request)}:${request.nextUrl.pathname}`,
    maxRequests,
    windowMs,
  );
  const rateHeaders = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
  };

  if (!result.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests. Try again shortly." } },
      {
        status: 429,
        headers: {
          ...rateHeaders,
          "Cache-Control": "no-store",
          "Retry-After": String(result.retryAfterSeconds),
        },
      },
    );
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(rateHeaders)) response.headers.set(key, value);
  return response;
}

function securePageResponse(request: NextRequest, response: NextResponse) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const secured = response.headers.has("location")
    ? response
    : NextResponse.next({ request: { headers: requestHeaders } });
  secured.headers.set("Content-Security-Policy", policy);
  return secured;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return secureApiMutation(request);

  const hasSessionCookie = Boolean(getSessionCookie(request));
  if (hasSessionCookie) return securePageResponse(request, NextResponse.next());

  const destination = getRouteRedirect(request.nextUrl.pathname, null);
  const response = destination
    ? NextResponse.redirect(new URL(destination, request.url))
    : NextResponse.next();
  return securePageResponse(request, response);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

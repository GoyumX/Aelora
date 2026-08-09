import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRouteRedirect } from "@/lib/auth/route-access";

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request));
  if (hasSessionCookie) return NextResponse.next();

  const destination = getRouteRedirect(request.nextUrl.pathname, null);
  return NextResponse.redirect(new URL(destination!, request.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/live-monitoring/:path*",
    "/ai-forecast/:path*",
    "/performance/:path*",
    "/historical-analytics/:path*",
    "/alerts/:path*",
    "/reports/:path*",
    "/system-configuration/:path*",
    "/settings/:path*",
    "/help/:path*",
    "/admin/:path*",
  ],
};

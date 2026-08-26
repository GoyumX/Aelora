import type { UserRole } from "@/lib/auth/authorization";

const protectedRoutePrefixes = [
  "/dashboard",
  "/live-monitoring",
  "/ai-forecast",
  "/performance",
  "/historical-analytics",
  "/alerts",
  "/reports",
  "/system-configuration",
  "/settings",
  "/help",
  "/admin",
] as const;

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getRouteRedirect(pathname: string, role: UserRole | null) {
  if (!role && isProtectedRoute(pathname)) {
    return `/sign-in?callbackUrl=${encodeURIComponent(pathname)}`;
  }

  if (!role) return null;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "ADMIN" ? null : "/dashboard";
  }

  return null;
}

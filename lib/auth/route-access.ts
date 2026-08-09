import type { UserRole } from "@/lib/auth/authorization";

export function getRouteRedirect(pathname: string, role: UserRole | null) {
  if (!role) {
    return `/sign-in?callbackUrl=${encodeURIComponent(pathname)}`;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "ADMIN" ? null : "/dashboard";
  }

  return null;
}

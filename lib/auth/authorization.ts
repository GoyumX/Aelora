export const userRoles = ["USER", "ADMIN"] as const;
export type UserRole = (typeof userRoles)[number];

type RoleCarrier = { role?: string | null };
type SiteActor = { id: string; role?: string | null };

export function normalizeUserRole(role?: string | null): UserRole {
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export function isAdmin(user: RoleCarrier): boolean {
  return normalizeUserRole(user.role) === "ADMIN";
}

export function canAccessSite(actor: SiteActor, ownerId: string): boolean {
  return isAdmin(actor) || actor.id === ownerId;
}

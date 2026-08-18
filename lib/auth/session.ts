import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdmin, normalizeUserRole } from "@/lib/auth/authorization";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || session.user.status === "DISABLED") {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: normalizeUserRole(session.user.role),
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}

import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return <AppShell role="ADMIN" user={user}>{children}</AppShell>;
}

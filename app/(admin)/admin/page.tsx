import type { Metadata } from "next";

import { AdminConsole } from "@/components/admin/admin-console";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminConsoleView } from "@/lib/admin/admin-service";

export const metadata: Metadata = { title: "Admin console" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  return <AdminConsole view={await getAdminConsoleView(admin.id)} />;
}

import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/admin/admin-service", () => ({ updateAdminUserStatus: mocks.update, AdminDomainError: class AdminDomainError extends Error { constructor(public code: string) { super(code); } } }));
import { PATCH } from "@/app/api/admin/users/[userId]/route";
const context = { params: Promise.resolve({ userId: "user-1" }) };
describe("admin user route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" }); mocks.update.mockResolvedValue({ id: "user-1", status: "DISABLED" }); });
  it("lets an administrator change user access without caching", async () => { const response = await PATCH(new Request("http://localhost/api/admin/users/user-1", { method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) }), context); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(mocks.update).toHaveBeenCalledWith({ id: "admin-1", role: "ADMIN" }, "user-1", { status: "DISABLED" }); });
  it("rejects a regular user", async () => { mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" }); const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "DISABLED" }) }), context); expect(response.status).toBe(403); expect(mocks.update).not.toHaveBeenCalled(); });
  it("validates status before mutation", async () => { const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "DELETED" }) }), context); expect(response.status).toBe(422); expect(mocks.update).not.toHaveBeenCalled(); });
});

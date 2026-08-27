import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), changePassword: vi.fn(), revokeOtherSessions: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/auth", () => ({ auth: { api: { changePassword: mocks.changePassword, revokeOtherSessions: mocks.revokeOtherSessions } } }));

import { DELETE, POST } from "@/app/api/settings/security/route";

describe("settings security route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.changePassword.mockResolvedValue({ status: true });
    mocks.revokeOtherSessions.mockResolvedValue({ status: true });
  });

  it("changes a password through Better Auth and revokes other sessions", async () => {
    const request = new Request("http://localhost/api/settings/security", { method: "POST", headers: { cookie: "session=example", "content-type": "application/json" }, body: JSON.stringify({ currentPassword: "OldPassword1!", newPassword: "NewPassword2!" }) });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.changePassword).toHaveBeenCalledWith(expect.objectContaining({ headers: request.headers, body: { currentPassword: "OldPassword1!", newPassword: "NewPassword2!", revokeOtherSessions: true } }));
  });

  it("revokes every session except the current one", async () => {
    const request = new Request("http://localhost/api/settings/security", { method: "DELETE", headers: { cookie: "session=example" } });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    expect(mocks.revokeOtherSessions).toHaveBeenCalledWith({ headers: request.headers });
  });

  it("validates password changes before calling Better Auth", async () => {
    const response = await POST(new Request("http://localhost/api/settings/security", { method: "POST", body: JSON.stringify({ currentPassword: "same-password", newPassword: "same-password" }) }));
    expect(response.status).toBe(422);
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });
});

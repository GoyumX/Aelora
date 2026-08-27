import { describe, expect, it, vi } from "vitest";

import { bootstrapAdmin, parseBootstrapAdminEnv } from "@/lib/admin/bootstrap";

describe("production admin bootstrap", () => {
  it("rejects missing, weak, or placeholder credentials", () => {
    expect(() => parseBootstrapAdminEnv({})).toThrow("BOOTSTRAP_ADMIN_EMAIL");
    expect(() =>
      parseBootstrapAdminEnv({
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_NAME: "Production Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "replace-with-a-password",
      }),
    ).toThrow("placeholder");
  });

  it("normalizes a valid configuration without returning the password in summaries", () => {
    const config = parseBootstrapAdminEnv({
      BOOTSTRAP_ADMIN_EMAIL: " Admin@Example.com ",
      BOOTSTRAP_ADMIN_NAME: " Production Admin ",
      BOOTSTRAP_ADMIN_USERNAME: " solar-admin ",
      BOOTSTRAP_ADMIN_PASSWORD: "V3ry-Long-Random-Production-Secret!",
    });

    expect(config).toEqual({
      email: "admin@example.com",
      name: "Production Admin",
      username: "solar-admin",
      password: "V3ry-Long-Random-Production-Secret!",
    });
    expect(JSON.stringify({ email: config.email, username: config.username })).not.toContain(
      config.password,
    );
  });

  it("creates a missing account once and idempotently promotes it", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user-1" });
    const signUpEmail = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
    const update = vi.fn().mockResolvedValue({ id: "user-1", email: "admin@example.com" });

    const result = await bootstrapAdmin(
      {
        email: "admin@example.com",
        name: "Production Admin",
        username: "solar-admin",
        password: "V3ry-Long-Random-Production-Secret!",
      },
      { findUnique, update, signUpEmail },
    );

    expect(signUpEmail).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ role: "ADMIN", status: "ACTIVE" }),
      }),
    );
    expect(result).toEqual({ created: true, email: "admin@example.com" });
  });
});

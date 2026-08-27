import { describe, expect, it } from "vitest";

import { adminTicketUpdateSchema, adminUserStatusSchema } from "@/lib/admin/admin";

describe("admin mutation validation", () => {
  it("accepts explicit active and disabled user states", () => {
    expect(adminUserStatusSchema.parse({ status: "ACTIVE" })).toEqual({ status: "ACTIVE" });
    expect(adminUserStatusSchema.parse({ status: "DISABLED" })).toEqual({ status: "DISABLED" });
    expect(adminUserStatusSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });

  it("requires a meaningful response before resolving or closing a ticket", () => {
    expect(adminTicketUpdateSchema.safeParse({ status: "IN_PROGRESS", response: null }).success).toBe(true);
    expect(adminTicketUpdateSchema.safeParse({ status: "RESOLVED", response: "The gateway credential was rotated and publishing recovered." }).success).toBe(true);
    expect(adminTicketUpdateSchema.safeParse({ status: "RESOLVED", response: null }).success).toBe(false);
    expect(adminTicketUpdateSchema.safeParse({ status: "CLOSED", response: "no" }).success).toBe(false);
  });
});

import { z } from "zod";

export const adminUserStatusSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) }).strict();

export const adminTicketUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  response: z.string().trim().min(5, "Use at least 5 characters.").max(2000).nullable(),
}).strict().superRefine((value, context) => {
  if ((value.status === "RESOLVED" || value.status === "CLOSED") && !value.response) context.addIssue({ code: "custom", path: ["response"], message: "A response is required before resolving or closing a ticket." });
});

export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;
export type AdminTicketUpdateInput = z.infer<typeof adminTicketUpdateSchema>;

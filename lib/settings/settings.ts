import { z } from "zod";

export const themePreferenceSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);
export const measurementSystemSchema = z.enum(["METRIC", "IMPERIAL"]);

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const settingsUpdateSchema = z.object({
  name: z.string().trim().min(2, "Display name must contain at least 2 characters.").max(80),
  username: z.string().trim().toLowerCase()
    .min(3, "Username must contain at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters.")
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Use letters, numbers, dots, underscores, or hyphens without spaces.")
    .nullable(),
  theme: themePreferenceSchema,
  timezone: z.string().min(1).max(80).refine(isTimeZone, "Choose a valid IANA timezone."),
  measurementSystem: measurementSystemSchema,
  emailNotifications: z.boolean(),
  defaultSiteId: z.string().min(1).max(100).nullable(),
}).strict();

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: z.string().min(10, "Use at least 10 characters.").max(128)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number."),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
  message: "The new password must differ from the current password.",
  path: ["newPassword"],
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
export type ThemePreferenceValue = z.infer<typeof themePreferenceSchema>;
export type MeasurementSystemValue = z.infer<typeof measurementSystemSchema>;

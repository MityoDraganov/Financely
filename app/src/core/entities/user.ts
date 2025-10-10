import z from "zod";
import { baseEntitySchema } from "./base";

export const userRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userDataSchema = z.object({
  clerkId: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  organizationRoles: z.record(z.string(), userRoleSchema).default({}),
  defaultOrganizationId: z.string().optional(),
  status: z.enum(["active", "suspended", "deleted"]).default("active"),
  preferences: z
    .object({
      theme: z.enum(["light", "dark", "system"]).default("system"),
      language: z.string().default("en"),
      timezone: z.string().default("UTC"),
    })
    .default({
      theme: "system",
      language: "en",
      timezone: "UTC",
    }),
});

export type UserData = z.infer<typeof userDataSchema>;

export const userSchema = baseEntitySchema.merge(userDataSchema);
export type User = z.infer<typeof userSchema>;

export type CreateUserInput = Omit<UserData, "status" | "organizationRoles" | "preferences"> & {
  status?: UserData["status"];
  organizationRoles?: UserData["organizationRoles"];
  preferences?: UserData["preferences"];
};
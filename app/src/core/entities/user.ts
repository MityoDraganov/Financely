import z from "zod";
import { baseEntitySchema } from "./base";
import { VALID_ROLES, type OrganizationRole } from "../roles";

/**
 * User role schema - uses centralized role definitions
 * @deprecated Use OrganizationRole from ../roles instead
 */
export const userRoleSchema = z.enum(VALID_ROLES as [OrganizationRole, ...OrganizationRole[]]);

/**
 * User role type - uses centralized role definitions
 * @deprecated Use OrganizationRole from ../roles instead
 */
export type UserRole = OrganizationRole;

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
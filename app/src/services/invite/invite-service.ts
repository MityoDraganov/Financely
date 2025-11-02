import { AuthUser } from "@/core";
import { Invite, InviteData } from "@/core/entities/invite";
import { Organization } from "@/core/entities/organization";
import { User } from "@/core/entities/user";
import { DatabaseCollection } from "@/repositories/config";
import { databaseService } from "@/services/database/database-service";
import { functionsService } from "@/services/functions/functions-service";

export interface InviteService {
  sendInvite: (inviteData: Omit<InviteData, "code" | "expiresAt" | "status">) => Promise<string>;
  getInvites: (organizationId: string) => Promise<Invite[]>;
  getInviteByToken: (token: string) => Promise<Invite | null>;
  getInviteByCode: (code: string) => Promise<Invite | null>;
  acceptInvite: (code: string, user: AuthUser) => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  resendInvite: (inviteId: string) => Promise<void>;
  getOrganizationName: (organizationId: string) => Promise<string>;
  addUserToOrganization: (organizationId: string, userId: string, role: string) => Promise<void>;
}

// Real Firebase implementation
export const inviteService: InviteService = {
  async sendInvite(inviteData) {
    // Generate a unique code
    const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const fullInviteData: InviteData = {
      ...inviteData,
      code,
      expiresAt,
      status: "active",
      role: inviteData.role || "member",
    };

    // Save the invite to Firebase
    const inviteId = await databaseService.create(
      DatabaseCollection.INVITES,
      fullInviteData
    );

    // Send email via Cloud Function
    try {
      await functionsService.sendInviteEmail({
        inviteId,
        organizationId: inviteData.organizationId,
      });
    } catch (error) {
      console.error("Failed to send invite email:", error);
      // Don't throw here - the invite is still created in the database
    }
    
    return inviteId;
  },

  async getInvites(organizationId: string) {
    return await databaseService.getPaginated<Invite>(
      DatabaseCollection.INVITES,
      [
        { field: "organizationId", operator: "==", value: organizationId },
        { field: "status", operator: "==", value: "pending" }
      ],
      { limit: 50 },
      { field: "createdAt", direction: "desc" }
    );
  },

  async getInviteByToken(token: string) {
    return await databaseService.getByField<Invite>(
      DatabaseCollection.INVITES,
      [{ field: "token", operator: "==", value: token }]
    );
  },

  async getInviteByCode(code: string) {
    return await databaseService.getByField<Invite>(
      DatabaseCollection.INVITES,
      [{ field: "code", operator: "==", value: code }]
    );
  },

  async acceptInvite(code: string, user: AuthUser) {
    // Get the invite by code
    const invite = await this.getInviteByCode(code);
    if (!invite) {
      throw new Error("Invalid invite code");
    }

    // Check if invite is still valid
    if (invite.status !== "active") {
      throw new Error("Invite has already been used or revoked");
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new Error("Invite has expired");
    }

    // Update the invite status
    await databaseService.update(
      DatabaseCollection.INVITES,
      invite.id,
      {
        status: "used",
        usedAt: new Date().toISOString(),
        usedBy: user.uid,
      }
    );

    // Add user to organization with member role
    await inviteService.addUserToOrganization(invite.organizationId, user.uid, "member");

    // Send welcome email
    try {
      await functionsService.sendWelcomeEmail({
        userId: user.uid,
        organizationId: invite.organizationId,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      // Don't throw here - the user is still added to the organization
    }
  },

  async revokeInvite(inviteId: string) {
    await databaseService.update(
      DatabaseCollection.INVITES,
      inviteId,
      {
        status: "revoked",
        revokedAt: new Date().toISOString(),
      }
    );
  },

  async resendInvite(inviteId: string) {
    const invite = await databaseService.get<Invite>(
      DatabaseCollection.INVITES,
      inviteId
    );

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "active") {
      throw new Error("Can only resend active invites");
    }

    // Send email via Cloud Function
    await functionsService.sendInviteEmail({
      inviteId: inviteId,
      organizationId: invite.organizationId,
    });
  },

  // Helper methods
  async getOrganizationName(organizationId: string): Promise<string> {
    const organization = await databaseService.get(
      DatabaseCollection.ORGANIZATIONS,
      organizationId
    );
    return (organization as Organization)?.name || "Unknown Organization";
  },

  async addUserToOrganization(organizationId: string, userId: string, role: string) {
    // Add user to organization's memberIds array
    await databaseService.addToSet(
      DatabaseCollection.ORGANIZATIONS,
      organizationId,
      "memberIds",
      userId
    );

    // Update user's organization roles
    const user = await databaseService.get(DatabaseCollection.USERS, userId);
    if (user) {
      const userData = user as User;
      const updatedRoles = {
        ...userData.organizationRoles,
        [organizationId]: role,
      };

      await databaseService.update(
        DatabaseCollection.USERS,
        userId,
        { organizationRoles: updatedRoles }
      );
    }
  },
};

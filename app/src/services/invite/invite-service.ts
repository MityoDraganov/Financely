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
  acceptInvite: (code: string, user: AuthUser) => Promise<{ success: boolean; organizationId: string; message: string }>; // user param kept for interface compatibility but not used (Cloud Function gets user from auth)
  revokeInvite: (inviteId: string) => Promise<Invite>;
  resendInvite: (inviteId: string) => Promise<Invite>;
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
    // Fetch all invites for the organization (we'll filter by status client-side)
    // This allows us to include both "active" and "sent" statuses
    const allInvites = await databaseService.getPaginated<Invite>(
      DatabaseCollection.INVITES,
      [
        { field: "organizationId", operator: "==", value: organizationId }
      ],
      { limit: 50 },
      { field: "createdAt", direction: "desc" }
    );
    
    // Filter to only include active and sent invites (exclude revoked, used, expired)
    return allInvites.filter(invite => 
      invite.status === "active" || invite.status === "sent"
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async acceptInvite(code: string, _user: AuthUser) {
    // Call the Cloud Function to accept the invite
    // This ensures server-side validation, transaction safety, and prevents race conditions
    // The user is authenticated via Firebase Auth in the Cloud Function, so user param is kept for interface compatibility but not used
    return await functionsService.acceptInvite({ code });
  },

  async revokeInvite(inviteId: string): Promise<Invite> {
    // Get the invite first to return it with organizationId
    const invite = await databaseService.get<Invite>(
      DatabaseCollection.INVITES,
      inviteId
    );
    
    if (!invite) {
      throw new Error("Invite not found");
    }

    await databaseService.update(
      DatabaseCollection.INVITES,
      inviteId,
      {
        status: "revoked",
        revokedAt: new Date().toISOString(),
      }
    );

    // Return updated invite with organizationId
    return {
      ...invite,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    };
  },

  async resendInvite(inviteId: string): Promise<Invite> {
    const invite = await databaseService.get<Invite>(
      DatabaseCollection.INVITES,
      inviteId
    );

    if (!invite) {
      throw new Error("Invite not found");
    }

    // Allow resending invites that are "active" (not yet sent) or "sent" (already sent but can be resent)
    if (invite.status !== "active" && invite.status !== "sent") {
      throw new Error("Can only resend active or sent invites");
    }

    // Send email via Cloud Function
    await functionsService.sendInviteEmail({
      inviteId: inviteId,
      organizationId: invite.organizationId,
    });

    return invite;
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

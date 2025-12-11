import { InviteRepository } from "../core/ports/repositories/invite-repository";
import { Invite, CreateInviteInput, InviteData } from "../core/entities/invite";
import { DatabaseService } from "../core/ports/services/database-service";
import { DatabaseCollection } from "./config";
import { ORGANIZATION_ROLES } from "../core/roles";

export function getInviteRepository(databaseService: DatabaseService): InviteRepository {
  return {
    async create(input: CreateInviteInput): Promise<Invite> {
      const expiresAt = input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days default

      // Generate a random code (this should ideally be done server-side)
      const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const inviteData: InviteData = {
        code,
        organizationId: input.organizationId,
        invitedBy: input.invitedBy,
        email: input.email,
        role: input.role || ORGANIZATION_ROLES.MEMBER,
        status: "active",
        expiresAt,
      };

      const id = await databaseService.create<InviteData>(
        DatabaseCollection.INVITES,
        inviteData
      );
      
      const created = await databaseService.get<Invite>(DatabaseCollection.INVITES, id);
      if (!created) {
        throw new Error("Failed to create invite");
      }
      
      return created as Invite;
    },

    async getById(id: string): Promise<Invite | null> {
      const invite = await databaseService.get<Invite>(DatabaseCollection.INVITES, id);
      return invite || null;
    },

    async getByCode(code: string): Promise<Invite | null> {
      const invite = await databaseService.getByField<Invite>(
        DatabaseCollection.INVITES,
        [{ field: "code", operator: "==", value: code }]
      );
      return invite || null;
    },

    async getByOrganizationId(organizationId: string): Promise<Invite[]> {
      return await databaseService.getPaginated<Invite>(
        DatabaseCollection.INVITES,
        [{ field: "organizationId", operator: "==", value: organizationId }],
        {},
        { field: "createdAt", direction: "desc" }
      );
    },

    async getActiveByOrganizationId(organizationId: string): Promise<Invite[]> {
      return await databaseService.getPaginated<Invite>(
        DatabaseCollection.INVITES,
        [
          { field: "organizationId", operator: "==", value: organizationId },
          { field: "status", operator: "==", value: "active" }
        ],
        {},
        { field: "createdAt", direction: "desc" }
      );
    },

    async update(id: string, updates: Partial<Invite>): Promise<Invite> {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      await databaseService.update(
        DatabaseCollection.INVITES,
        id,
        updateData
      );
      
      const updated = await databaseService.get<Invite>(DatabaseCollection.INVITES, id);
      if (!updated) {
        throw new Error("Failed to update invite");
      }
      
      return updated as Invite;
    },

    async markAsUsed(id: string, usedBy: string): Promise<Invite> {
      const now = new Date().toISOString();
      return this.update(id, {
        status: "used",
        usedAt: now,
        usedBy,
      });
    },

    async markAsRevoked(id: string, revokedBy: string): Promise<Invite> {
      const now = new Date().toISOString();
      return this.update(id, {
        status: "revoked",
        revokedAt: now,
        revokedBy,
      });
    },

    async delete(id: string): Promise<void> {
      await databaseService.delete(DatabaseCollection.INVITES, id);
    },

    async isCodeUnique(code: string): Promise<boolean> {
      const existing = await databaseService.getByField<Invite>(
        DatabaseCollection.INVITES,
        [{ field: "code", operator: "==", value: code }]
      );
      return !existing;
    },
  };
}


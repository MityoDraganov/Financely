import { Invite, CreateInviteInput, isInviteActive, isInviteUsed } from "../core/entities/invite";
import { InviteRepository } from "../core/ports/repositories/invite-repository";
import { OrganizationRepository } from "../core/ports/repositories/organization-repository";
import { UserRepository } from "../core/ports/repositories/user-repository";

export interface InviteService {
  /**
   * Create a new invite with a unique code
   */
  createInvite(input: CreateInviteInput): Promise<Invite>;

  /**
   * Get all invites for an organization
   */
  getInvitesByOrganization(organizationId: string): Promise<Invite[]>;

  /**
   * Get active invites for an organization
   */
  getActiveInvitesByOrganization(organizationId: string): Promise<Invite[]>;

  /**
   * Get an invite by code
   */
  getInviteByCode(code: string): Promise<Invite | null>;

  /**
   * Use an invite (mark as used)
   */
  useInvite(code: string, usedBy: string): Promise<Invite>;

  /**
   * Revoke an invite
   */
  revokeInvite(inviteId: string, revokedBy: string): Promise<Invite>;

  /**
   * Delete an invite
   */
  deleteInvite(inviteId: string): Promise<void>;

  /**
   * Check if user can create invites for organization
   */
  canCreateInvites(userId: string, organizationId: string): Promise<boolean>;
}

export function createInviteService(
  inviteRepository: InviteRepository,
  organizationRepository: OrganizationRepository,
  userRepository: UserRepository
): InviteService {
  return {
    async createInvite(input: CreateInviteInput): Promise<Invite> {
      // Check if user can create invites
      const canCreate = await this.canCreateInvites(input.invitedBy, input.organizationId);
      if (!canCreate) {
        throw new Error("User does not have permission to create invites for this organization");
      }

      // Generate unique code
      const code = await this.generateUniqueCode();

      const inviteInput = {
        ...input,
        code,
      };

      return inviteRepository.create(inviteInput);
    },

    async getInvitesByOrganization(organizationId: string): Promise<Invite[]> {
      return inviteRepository.getByOrganizationId(organizationId);
    },

    async getActiveInvitesByOrganization(organizationId: string): Promise<Invite[]> {
      return inviteRepository.getActiveByOrganizationId(organizationId);
    },

    async getInviteByCode(code: string): Promise<Invite | null> {
      return inviteRepository.getByCode(code);
    },

    async useInvite(code: string, usedBy: string): Promise<Invite> {
      const invite = await inviteRepository.getByCode(code);
      
      if (!invite) {
        throw new Error("Invite not found");
      }

      if (!isInviteActive(invite)) {
        throw new Error("Invite is not active or has expired");
      }

      if (isInviteUsed(invite)) {
        throw new Error("Invite has already been used");
      }

      return inviteRepository.markAsUsed(invite.id, usedBy);
    },

    async revokeInvite(inviteId: string, revokedBy: string): Promise<Invite> {
      // Check if user can revoke invites
      const invite = await inviteRepository.getById(inviteId);
      if (!invite) {
        throw new Error("Invite not found");
      }

      const canCreate = await this.canCreateInvites(revokedBy, invite.organizationId);
      if (!canCreate) {
        throw new Error("User does not have permission to revoke invites for this organization");
      }

      return inviteRepository.markAsRevoked(inviteId, revokedBy);
    },

    async deleteInvite(inviteId: string): Promise<void> {
      return inviteRepository.delete(inviteId);
    },

    async canCreateInvites(userId: string, organizationId: string): Promise<boolean> {
      try {
        // Get user and organization
        const user = await userRepository.getById(userId);
        const organization = await organizationRepository.getById(organizationId);

        if (!user || !organization) {
          return false;
        }

        // Check if user is a member of the organization
        if (!organization.memberIds.includes(userId)) {
          return false;
        }

        // Check if user has owner or admin role
        const userRole = user.organizationRoles[organizationId];
        return userRole === "owner" || userRole === "admin";
      } catch (error) {
        console.error("Error checking invite permissions:", error);
        return false;
      }
    },

    /**
     * Generate a unique invite code
     */
    async generateUniqueCode(): Promise<string> {
      const generateCode = (): string => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      let code: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        code = generateCode();
        isUnique = await inviteRepository.isCodeUnique(code);
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new Error("Failed to generate unique invite code");
      }

      return code;
    },
  };
}

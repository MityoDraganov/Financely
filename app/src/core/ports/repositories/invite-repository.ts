import { Invite, CreateInviteInput } from "../../entities/invite";

export interface InviteRepository {
  /**
   * Create a new invite
   */
  create(input: CreateInviteInput): Promise<Invite>;

  /**
   * Get an invite by its ID
   */
  getById(id: string): Promise<Invite | null>;

  /**
   * Get an invite by its code
   */
  getByCode(code: string): Promise<Invite | null>;

  /**
   * Get all invites for an organization
   */
  getByOrganizationId(organizationId: string): Promise<Invite[]>;

  /**
   * Get active invites for an organization (not used, not expired)
   */
  getActiveByOrganizationId(organizationId: string): Promise<Invite[]>;

  /**
   * Update an invite
   */
  update(id: string, updates: Partial<Invite>): Promise<Invite>;

  /**
   * Mark an invite as used
   */
  markAsUsed(id: string, usedBy: string): Promise<Invite>;

  /**
   * Mark an invite as revoked
   */
  markAsRevoked(id: string, revokedBy: string): Promise<Invite>;

  /**
   * Delete an invite
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a code is unique
   */
  isCodeUnique(code: string): Promise<boolean>;
}

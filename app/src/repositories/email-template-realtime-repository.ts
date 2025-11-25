import { EmailTemplate, EmailTemplateData } from "@/core";
import { realtimeDatabaseService, RealtimeUnsubscribeFn } from "@/services/database/realtime-database-service";

const EMAIL_TEMPLATES_PATH = "emailTemplates";

/**
 * Email Template Repository using Firebase Realtime Database
 * Enables real-time collaborative editing
 */
export function getEmailTemplateRealtimeRepository() {
  return {
    async get(payload: { id: string }) {
      return realtimeDatabaseService.get<EmailTemplate>(EMAIL_TEMPLATES_PATH, payload.id);
    },

    async getAll(payload: {
      queryConstraints?: Array<{ field: string; operator: string; value: unknown }>;
    }) {
      const constraints = payload.queryConstraints || [];
      const orgIdConstraint = constraints.find((c) => c.field === "orgId");

      if (orgIdConstraint) {
        return realtimeDatabaseService.getAll<EmailTemplate>(EMAIL_TEMPLATES_PATH, {
          orderBy: "orgId",
          equalTo: orgIdConstraint.value as string,
        });
      }

      return realtimeDatabaseService.getAll<EmailTemplate>(EMAIL_TEMPLATES_PATH);
    },

    async getAllGroup(payload: {
      queryConstraints?: Array<{ field: string; operator: string; value: unknown }>;
    }) {
      // For Realtime Database, getAllGroup works the same as getAll
      return this.getAll(payload);
    },

    async getAllGroupByID(payload: { id: string }) {
      const template = await realtimeDatabaseService.get<EmailTemplate>(
        EMAIL_TEMPLATES_PATH,
        payload.id
      );
      return template ? [template] : [];
    },

    async create(payload: { data: EmailTemplateData }) {
      return realtimeDatabaseService.create<EmailTemplateData>(
        EMAIL_TEMPLATES_PATH,
        payload.data
      );
    },

    async set(payload: { id: string; data: EmailTemplateData }) {
      await realtimeDatabaseService.set<EmailTemplateData>(
        EMAIL_TEMPLATES_PATH,
        payload.id,
        payload.data
      );
    },

    async update(payload: { id: string; data: Partial<EmailTemplateData> }) {
      await realtimeDatabaseService.update<Partial<EmailTemplateData>>(
        EMAIL_TEMPLATES_PATH,
        payload.id,
        payload.data
      );
    },

    async delete(payload: { id: string }) {
      await realtimeDatabaseService.delete(EMAIL_TEMPLATES_PATH, payload.id);
    },

    async increment(_payload: unknown) {
      // Realtime Database doesn't have built-in increment
      throw new Error("Increment not implemented for Realtime Database");
    },

    async addToSet(_payload: unknown) {
      throw new Error("AddToSet not implemented for Realtime Database");
    },

    async removeFromSet(_payload: unknown) {
      throw new Error("RemoveFromSet not implemented for Realtime Database");
    },

    /**
     * Subscribe to all email templates for an organization with real-time updates
     */
    subscribeToAll(orgId: string, callback: (templates: EmailTemplate[]) => void): RealtimeUnsubscribeFn {
      console.log("[EMAIL-TEMPLATE-REPO] Starting subscription for orgId:", orgId);
      
      // Subscribe to all templates and filter client-side
      return realtimeDatabaseService.subscribeToCollection<EmailTemplate>(
        EMAIL_TEMPLATES_PATH,
        (allTemplates: EmailTemplate[] | null) => {
          if (!allTemplates) {
            callback([]);
            return;
          }
          
          console.log("[EMAIL-TEMPLATE-REPO] Raw templates received:", allTemplates);
          
          // Filter by orgId client-side
          const filtered = allTemplates.filter(t => t && t.orgId === orgId);
          console.log("[EMAIL-TEMPLATE-REPO] Filtered templates:", filtered.length, "from", allTemplates.length, "total");
          callback(filtered);
        }
      );
    },
  };
}


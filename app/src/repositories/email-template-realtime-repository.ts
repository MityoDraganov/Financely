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
      console.log("[EMAIL-TEMPLATE-REPO] UPDATE called", {
        id: payload.id,
        path: EMAIL_TEMPLATES_PATH,
        dataKeys: Object.keys(payload.data),
        hasBlocks: !!payload.data.blocks,
        blocksCount: payload.data.blocks?.length,
        timestamp: new Date().toISOString(),
      });
      await realtimeDatabaseService.update<Partial<EmailTemplateData>>(
        EMAIL_TEMPLATES_PATH,
        payload.id,
        payload.data
      );
      console.log("[EMAIL-TEMPLATE-REPO] UPDATE completed", {
        id: payload.id,
        timestamp: new Date().toISOString(),
      });
    },

    async delete(payload: { id: string }) {
      await realtimeDatabaseService.delete(EMAIL_TEMPLATES_PATH, payload.id);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async increment(_payload: unknown) {
      // Realtime Database doesn't have built-in increment
      // Would need to implement with transaction if needed
      throw new Error("Increment not implemented for Realtime Database");
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async addToSet(_payload: unknown) {
      // Would need custom implementation for array operations
      throw new Error("AddToSet not implemented for Realtime Database");
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async removeFromSet(_payload: unknown) {
      // Would need custom implementation for array operations
      throw new Error("RemoveFromSet not implemented for Realtime Database");
    },

    /**
     * Subscribe to all email templates for an organization with real-time updates
     */
    subscribeToAll(orgId: string, callback: (templates: EmailTemplate[]) => void): RealtimeUnsubscribeFn {
      console.log("[EMAIL-TEMPLATE-REPO] Starting subscription for orgId:", orgId, "at", new Date().toISOString());
      
      // Subscribe to all templates and filter client-side
      const unsubscribe = realtimeDatabaseService.subscribeToCollection<EmailTemplate>(
        EMAIL_TEMPLATES_PATH,
        (allTemplates: EmailTemplate[] | null) => {
          const timestamp = new Date().toISOString();
          console.log("[EMAIL-TEMPLATE-REPO] Real-time callback triggered", {
            timestamp,
            orgId,
            allTemplatesCount: allTemplates?.length ?? 0,
            allTemplatesIsNull: allTemplates === null,
          });
          
          if (!allTemplates) {
            console.log("[EMAIL-TEMPLATE-REPO] No templates found, calling callback with empty array");
            callback([]);
            return;
          }
          
          console.log("[EMAIL-TEMPLATE-REPO] Raw templates received:", {
            count: allTemplates.length,
            templateIds: allTemplates.map(t => t?.id).filter(Boolean),
            orgIds: allTemplates.map(t => t?.orgId).filter(Boolean),
          });
          
          // Filter by orgId client-side
          const filtered = allTemplates.filter(t => t && t.orgId === orgId);
          console.log("[EMAIL-TEMPLATE-REPO] Filtered templates:", {
            filteredCount: filtered.length,
            totalCount: allTemplates.length,
            orgId,
            filteredIds: filtered.map(t => t.id),
            timestamp,
          });
          
          // Log details of each filtered template
          filtered.forEach(template => {
            console.log("[EMAIL-TEMPLATE-REPO] Template details:", {
              id: template.id,
              name: template.name,
              blocksCount: template.blocks?.length ?? 0,
              lastModified: (template as any).updatedAt || (template as any).modifiedAt || "unknown",
            });
          });
          
          callback(filtered);
        }
      );
      
      console.log("[EMAIL-TEMPLATE-REPO] Subscription established, unsubscribe function returned");
      return unsubscribe;
    },
  };
}


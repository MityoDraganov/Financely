import { Template, TemplateData } from "@/core";
import { TemplateRepository } from "@/core/ports/repositories/template-reposity";
import { realtimeDatabaseService, RealtimeUnsubscribeFn } from "@/services/database/realtime-database-service";

const TEMPLATES_PATH = "templates";

/**
 * Template Repository using Firebase Realtime Database
 * Enables real-time collaborative editing
 */
export function getTemplateRealtimeRepository(): TemplateRepository & {
  subscribeToAll: (
    orgId: string,
    callback: (templates: Template[]) => void
  ) => RealtimeUnsubscribeFn;
} {
  return {
    async get(payload) {
      return realtimeDatabaseService.get<Template>(TEMPLATES_PATH, payload.id);
    },

    async getAll(payload) {
      const constraints = payload.queryConstraints || [];
      const orgIdConstraint = constraints.find((c) => c.field === "orgId");

      if (orgIdConstraint) {
        return realtimeDatabaseService.getAll<Template>(TEMPLATES_PATH, {
          orderBy: "orgId",
          equalTo: orgIdConstraint.value as string,
        });
      }

      return realtimeDatabaseService.getAll<Template>(TEMPLATES_PATH);
    },

    async getAllGroup(payload) {
      // For Realtime Database, getAllGroup works the same as getAll
      return this.getAll(payload);
    },

    async getAllGroupByID(payload) {
      const template = await realtimeDatabaseService.get<Template>(
        TEMPLATES_PATH,
        payload.id
      );
      return template ? [template] : [];
    },

    async create(payload) {
      return realtimeDatabaseService.create<TemplateData>(
        TEMPLATES_PATH,
        payload.data
      );
    },

    async set(payload) {
      await realtimeDatabaseService.set<TemplateData>(
        TEMPLATES_PATH,
        payload.id,
        payload.data
      );
    },

    async update(payload) {
      await realtimeDatabaseService.update<TemplateData>(
        TEMPLATES_PATH,
        payload.id,
        payload.data
      );
    },

    async delete(payload) {
      await realtimeDatabaseService.delete(TEMPLATES_PATH, payload.id);
    },

    async increment(_payload) {
      // Realtime Database doesn't have built-in increment
      // Would need to implement with transaction if needed
      throw new Error("Increment not implemented for Realtime Database");
    },

    async addToSet(_payload) {
      // Would need custom implementation for array operations
      throw new Error("AddToSet not implemented for Realtime Database");
    },

    async removeFromSet(_payload) {
      // Would need custom implementation for array operations
      throw new Error("RemoveFromSet not implemented for Realtime Database");
    },

    /**
     * Subscribe to all templates for an organization with real-time updates
     */
    subscribeToAll(orgId: string, callback: (templates: Template[]) => void) {
      console.log("[TEMPLATE-REPO] Starting subscription for orgId:", orgId);
      
      // Subscribe to all templates and filter client-side
      // This avoids index requirements and is fine for small datasets
      return realtimeDatabaseService.subscribeToCollection<Template>(
        TEMPLATES_PATH,
        (allTemplates: Template[] | null) => {
          if (!allTemplates) {
            callback([]);
            return;
          }
          
          console.log("[TEMPLATE-REPO] Raw templates received:", allTemplates);
          
          // Filter by orgId client-side
          const filtered = allTemplates.filter(t => t && t.orgId === orgId);
          console.log("[TEMPLATE-REPO] Filtered templates:", filtered.length, "from", allTemplates.length, "total");
          console.log("[TEMPLATE-REPO] Filtered templates data:", filtered);
          callback(filtered);
        }
      );
    },
  };
}


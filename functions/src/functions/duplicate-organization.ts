import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import { getDuplicationJobRepository } from "../repositories/duplication-job-repository";
import { DuplicationJobData } from "../core/entities/duplication-job";
import { getDuplicationJobProcessor } from "../services/organization-duplication/duplication-job-processor";
import { duplicationOptionsSchema } from "../core/entities/duplication-mode";

/**
 * Duplicate Organization Cloud Function
 * 
 * Creates a duplication job for async processing.
 * ALWAYS duplicates all entities (templates, workflows, email templates, products, etc.)
 */
export const duplicateOrganization = onCall<
  {
    sourceOrgId: string;
    targetOrgName: string;
    options?: Partial<{
      includePrices: boolean;
      resetWorkflows: boolean;
      resetWebhooks: boolean;
      resetApiKeys: boolean;
      resetDomains: boolean;
      conflictResolution: "suffix" | "user_input" | "skip";
      customSuffix?: string;
    }>;
  },
  Promise<{ jobId: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const payload = request.data;

      if (!payload) {
        throw new HttpsError("invalid-argument", "Missing request payload");
      }

      const { sourceOrgId, targetOrgName, options } = payload;

      if (!sourceOrgId || !targetOrgName) {
        throw new HttpsError("invalid-argument", "Missing required fields: sourceOrgId, targetOrgName");
      }

      // Verify authentication and org membership (owner/admin only)
      const authResult = await verifyAuthAndOrgMembership(request, sourceOrgId, {
        requiredRole: ORGANIZATION_ROLES.OWNER,
      });

      const userId = authResult.userId;

      // Get default options and merge with provided options
      const defaultOptions = duplicationOptionsSchema.parse({});
      const finalOptions = duplicationOptionsSchema.parse({
        ...defaultOptions,
        ...options,
      });

      // Create duplication job
      const databaseService = getDatabaseService();
      const jobRepository = getDuplicationJobRepository(databaseService);

      const jobData: DuplicationJobData = {
        sourceOrgId,
        targetOrgName,
        createdBy: userId,
        options: finalOptions,
        status: "pending",
        progress: {
          totalEntities: 0,
          processedEntities: 0,
          percentage: 0,
        },
        errors: [],
        stats: {
          entitiesCreated: {},
          entitiesSkipped: 0,
          entitiesFailed: 0,
          conflictsResolved: 0,
        },
      };

      const jobId = await jobRepository.create({ data: jobData });

      // Process job immediately
      try {
        const processor = getDuplicationJobProcessor(databaseService);
        await processor.processJob(jobId);
      } catch (error) {
        console.error("Error processing duplication job:", error);
      }

      return { jobId };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", `Failed to create duplication job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

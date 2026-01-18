import { DatabaseService } from "../../core";
import { DuplicationJobStatus } from "../../core/entities/duplication-job";
import { OrganizationDuplicationService } from "./duplication-service";
import { getDuplicationJobRepository } from "../../repositories/duplication-job-repository";
import { getDatabaseService } from "../database-service";

export class DuplicationJobProcessor {
  private duplicationService: OrganizationDuplicationService;
  private jobRepository: ReturnType<typeof getDuplicationJobRepository>;

  constructor(databaseService: DatabaseService) {
    this.duplicationService = new OrganizationDuplicationService(databaseService);
    this.jobRepository = getDuplicationJobRepository(databaseService);
  }

  async processJob(jobId: string): Promise<void> {
    const job = await this.jobRepository.get({ id: jobId });
    if (!job) {
      throw new Error(`Duplication job not found: ${jobId}`);
    }

    if (job.status === "processing" || job.status === "completed") {
      return;
    }

    await this.jobRepository.update({
      id: jobId,
      data: {
        status: "processing" as DuplicationJobStatus,
        startedAt: new Date().toISOString(),
      },
    });

    try {
      const result = await this.duplicationService.duplicateOrganization({
        sourceOrgId: job.sourceOrgId,
        targetOrgName: job.targetOrgName,
        createdBy: job.createdBy,
        options: job.options,
      });

      const totalEntities = Object.values(result.entitiesCreated).reduce((sum, count) => sum + count, 0);

      await this.jobRepository.update({
        id: jobId,
        data: {
          status: "completed" as DuplicationJobStatus,
          targetOrgId: result.targetOrgId,
          completedAt: new Date().toISOString(),
          progress: {
            totalEntities,
            processedEntities: totalEntities,
            percentage: 100,
          },
          stats: {
            entitiesCreated: result.entitiesCreated,
            entitiesSkipped: result.entitiesSkipped,
            entitiesFailed: result.entitiesFailed,
            conflictsResolved: result.conflictsResolved,
          },
          errors: result.errors.map((error) => ({
            entityType: error.entityType,
            entityId: error.entityId,
            error: error.error,
            timestamp: new Date().toISOString(),
          })),
        },
      });
    } catch (error) {
      await this.jobRepository.update({
        id: jobId,
        data: {
          status: "failed" as DuplicationJobStatus,
          completedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
          errors: [
            {
              entityType: "organization",
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      throw error;
    }
  }
}

export function getDuplicationJobProcessor(databaseService?: DatabaseService): DuplicationJobProcessor {
  const dbService = databaseService || getDatabaseService();
  return new DuplicationJobProcessor(dbService);
}

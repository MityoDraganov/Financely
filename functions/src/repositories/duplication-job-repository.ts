import { DatabaseService } from "../core";
import { DuplicationJob, DuplicationJobData } from "../core/entities/duplication-job";
import { DuplicationJobRepository } from "../core/ports/repositories/duplication-job-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `DuplicationJobRepository` backed by the provided `DatabaseService`.
 */
export function getDuplicationJobRepository(
  databaseService: DatabaseService,
): DuplicationJobRepository {
  return getGenericRepository<DuplicationJob, DuplicationJobData>(
    () => DatabaseCollection.DUPLICATION_JOBS,
    databaseService,
  );
}

import { DatabaseService } from "../core";
import { ExtractionJob, ExtractionJobData } from "../core/entities/invoice-extraction-job";
import { ExtractionJobRepository } from "../core/ports/repositories/extraction-job-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for an `ExtractionJobRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ExtractionJobRepository} Repository with CRUD operations for extraction jobs.
 */
export function getExtractionJobRepository(
  databaseService: DatabaseService,
): ExtractionJobRepository {
  return getGenericRepository<ExtractionJob, ExtractionJobData>(
    () => DatabaseCollection.EXTRACTION_JOBS,
    databaseService,
  );
}


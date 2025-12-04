import { DatabaseService } from "../core";
import { TemplatePattern, TemplatePatternData } from "../core/entities/invoice-template-pattern";
import { TemplatePatternRepository } from "../core/ports/repositories/template-pattern-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `TemplatePatternRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {TemplatePatternRepository} Repository with CRUD operations for template patterns.
 */
export function getTemplatePatternRepository(
  databaseService: DatabaseService,
): TemplatePatternRepository {
  return getGenericRepository<TemplatePattern, TemplatePatternData>(
    () => DatabaseCollection.TEMPLATE_PATTERNS,
    databaseService,
  );
}


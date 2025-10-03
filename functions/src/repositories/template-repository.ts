import { DatabaseService } from "../core";
import { Template, TemplateData } from "../core/entities/template";
import { TemplateRepository } from "../core/ports/repositories/template-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `TemplateRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {TemplateRepository} Repository with CRUD operations for templates.
 */
export function getTemplateRepository(
  databaseService: DatabaseService,
): TemplateRepository {
  return getGenericRepository<Template, TemplateData>(
    () => DatabaseCollection.TEMPLATES,
    databaseService,
  );
}


import { DatabaseService } from "../services/database-service";
import { TemplateRepository } from "./template-reposity";

export interface RepositoryHost {
    getTemplatesReposity(databaseService: DatabaseService): TemplateRepository;
}
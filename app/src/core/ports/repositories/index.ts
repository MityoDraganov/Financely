import { DatabaseService } from "../services/database-service";
import { TemplateRepository } from "./template-reposity";
import { InvoiceRepository } from "./invoice-repository";

export interface RepositoryHost {
    getTemplatesReposity(databaseService: DatabaseService): TemplateRepository;
    getInvoicesReposity(databaseService: DatabaseService): InvoiceRepository;
}
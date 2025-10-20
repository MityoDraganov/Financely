import { DatabaseService } from "../services/database-service";
import { TemplateRepository } from "./template-reposity";
import { InvoiceRepository } from "./invoice-repository";
import { OrganizationRepository } from "./organization-repository";
import { UserRepository } from "./user-repository";
import { InviteRepository } from "./invite-repository";

export interface RepositoryHost {
    getTemplatesReposity(databaseService: DatabaseService): TemplateRepository;
    getInvoicesReposity(databaseService: DatabaseService): InvoiceRepository;
    getOrganizationsRepository(databaseService: DatabaseService): OrganizationRepository;
    getUsersRepository(databaseService: DatabaseService): UserRepository;
    getInvitesRepository(databaseService: DatabaseService): InviteRepository;
}
import { DatabaseService } from "../services/database-service";
import { TemplateRepository } from "./template-reposity";
import { InvoiceRepository } from "./invoice-repository";
import { OrganizationRepository } from "./organization-repository";
import { UserRepository } from "./user-repository";
import { InviteRepository } from "./invite-repository";
import { WorkflowRepository } from "./workflow-repository";
import { TaskRepository } from "./task-repository";
import { NotificationRepository } from "./notification-repository";
import { ContactRepository } from "./contact-repository";

export interface RepositoryHost {
    getTemplatesReposity(databaseService: DatabaseService): TemplateRepository;
    getInvoicesReposity(databaseService: DatabaseService): InvoiceRepository;
    getOrganizationsRepository(databaseService: DatabaseService): OrganizationRepository;
    getUsersRepository(databaseService: DatabaseService): UserRepository;
    getInvitesRepository(databaseService: DatabaseService): InviteRepository;
    getWorkflowsRepository(databaseService: DatabaseService): WorkflowRepository;
    getTasksRepository(databaseService: DatabaseService): TaskRepository;
    getNotificationsRepository(databaseService: DatabaseService): NotificationRepository;
    getContactsRepository(databaseService: DatabaseService): ContactRepository;
}
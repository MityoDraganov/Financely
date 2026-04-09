import { DatabaseService } from "../services/database-service";
import { InvoiceRepository } from "./invoice-repository";
import { OpportunityRepository } from "./opportunity-repository";
import { CommercialCaseRepository, CommercialCaseEventRepository } from "./commercial-case-repository";
import { OrganizationRepository } from "./organization-repository";
import { UserRepository } from "./user-repository";
import { WorkflowRepository } from "./workflow-repository";

export interface RepositoryHost {
    getInvoiceRepository: (
      databaseService: DatabaseService,
    ) => InvoiceRepository;
    getOpportunitiesRepository: (
      databaseService: DatabaseService,
    ) => OpportunityRepository;
    getCommercialCasesRepository: (
      databaseService: DatabaseService,
    ) => CommercialCaseRepository;
    getCommercialCaseEventsRepository: (
      databaseService: DatabaseService,
    ) => CommercialCaseEventRepository;
    getOrganizationsRepository: (
      databaseService: DatabaseService,
    ) => OrganizationRepository;
    getUsersRepository: (
      databaseService: DatabaseService,
    ) => UserRepository;
    getWorkflowsRepository: (
      databaseService: DatabaseService,
    ) => WorkflowRepository;
}

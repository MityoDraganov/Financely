import { DatabaseService } from "../services/database-service";
import { InvoiceRepository } from "./invoice-repository";
import { OrganizationRepository } from "./organization-repository";
import { UserRepository } from "./user-repository";

export interface RepositoryHost {
    getInvoiceRepository: (
      databaseService: DatabaseService,
    ) => InvoiceRepository;
    getOrganizationsRepository: (
      databaseService: DatabaseService,
    ) => OrganizationRepository;
    getUsersRepository: (
      databaseService: DatabaseService,
    ) => UserRepository;
}

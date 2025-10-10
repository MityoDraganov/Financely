import { Organization, OrganizationData } from "../../entities/organization";
import { GenericRepository } from "./generic-repository";

export type OrganizationRepository = GenericRepository<Organization, OrganizationData>;


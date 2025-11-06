import { Lead, LeadData } from "../../entities/lead";
import { GenericRepository } from "./generic-repository";

export type LeadRepository = GenericRepository<Lead, LeadData>;


import { DuplicationJob, DuplicationJobData } from "../../entities/duplication-job";
import { GenericRepository } from "./generic-repository";

export interface DuplicationJobRepository extends GenericRepository<DuplicationJob, DuplicationJobData> {}

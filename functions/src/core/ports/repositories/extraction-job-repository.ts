import { ExtractionJob, ExtractionJobData } from "../../entities/invoice-extraction-job";
import { GenericRepository } from "./generic-repository";

export type ExtractionJobRepository = GenericRepository<ExtractionJob, ExtractionJobData>;


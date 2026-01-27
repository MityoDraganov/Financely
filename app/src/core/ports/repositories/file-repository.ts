import { File, FileData } from "../../entities/file";
import { GenericRepository } from "./generic-repository";

export type FileRepository = GenericRepository<File, FileData>;

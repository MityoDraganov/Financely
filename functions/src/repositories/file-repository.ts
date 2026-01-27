import { DatabaseService } from "../core";
import { File, FileData } from "../core/entities/file";
import { FileRepository } from "../core/ports/repositories/file-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getFileRepository(
  databaseService: DatabaseService,
): FileRepository {
  return getGenericRepository<File, FileData>(
    () => DatabaseCollection.FILES,
    databaseService,
  );
}

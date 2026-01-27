import { FileRepository, DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getFileRepository(
  databaseService: DatabaseService,
): FileRepository {
  return getGenericRepository<import("@/core").File, import("@/core").FileData>(
    () => DatabaseCollection.FILES,
    databaseService,
  );
}

import { DatabaseService } from "../core";
import { ExternalSourceConfig, ExternalSourceConfigData } from "../core/entities/external-source-config";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getExternalSourceConfigRepository(
  databaseService: DatabaseService
) {
  return getGenericRepository<ExternalSourceConfig, ExternalSourceConfigData>(
    () => DatabaseCollection.EXTERNAL_SOURCE_CONFIGS,
    databaseService,
  );
}


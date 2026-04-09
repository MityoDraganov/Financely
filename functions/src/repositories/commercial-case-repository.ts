import { DatabaseService } from "../core";
import {
  CommercialCaseEventRepository,
  CommercialCaseRepository,
} from "../core/ports/repositories/commercial-case-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getCommercialCaseRepository(
  databaseService: DatabaseService,
): CommercialCaseRepository {
  return getGenericRepository(
    () => DatabaseCollection.COMMERCIAL_CASES,
    databaseService,
  );
}

export function getCommercialCaseEventRepository(
  databaseService: DatabaseService,
): CommercialCaseEventRepository {
  return getGenericRepository(
    () => DatabaseCollection.COMMERCIAL_CASE_EVENTS,
    databaseService,
  );
}

import { AnalyticsView, AnalyticsViewData } from "@/core";
import { DatabaseService } from "@/core/ports/services/database-service";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getAnalyticsViewRepository(databaseService: DatabaseService) {
  return getGenericRepository<AnalyticsView, AnalyticsViewData>(
    () => DatabaseCollection.ANALYTICS_VIEWS,
    databaseService,
  );
}

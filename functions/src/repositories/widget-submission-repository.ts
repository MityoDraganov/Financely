import { DatabaseService } from "../core";
import {
  WidgetSubmission,
  WidgetSubmissionData,
} from "../core/entities/widget-submission";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export function getWidgetSubmissionRepository(
  databaseService: DatabaseService,
) {
  return getGenericRepository<WidgetSubmission, WidgetSubmissionData>(
    () => DatabaseCollection.WIDGET_SUBMISSIONS,
    databaseService,
  );
}

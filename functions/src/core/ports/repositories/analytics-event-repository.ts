import { AnalyticsEventData } from "../../entities/analytics-event";

export interface AnalyticsEventRepository {
  create(orgId: string, data: AnalyticsEventData): Promise<string>;
}


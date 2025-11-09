import { AnalyticsConfig, AnalyticsConfigData } from "../../entities/analytics-config";

export interface AnalyticsConfigRepository {
  get(orgId: string): Promise<AnalyticsConfig | null>;
  set(orgId: string, data: AnalyticsConfigData): Promise<void>;
  update(orgId: string, data: Partial<AnalyticsConfigData>): Promise<void>;
  delete(orgId: string): Promise<void>;
}


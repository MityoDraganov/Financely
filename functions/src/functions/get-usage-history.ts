/**
 * Cloud Function to fetch usage history for billing dashboard
 * 
 * Returns aggregated usage data grouped by billing periods.
 * Supports current period (default), previous period, or custom date range.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { firestore } from "../infrastructure/firebase";

type PeriodType = "current" | "previous" | "custom";

interface GetUsageHistoryPayload {
  organizationId: string;
  periodType?: PeriodType; // "current" (default), "previous", or "custom"
  startDate?: string; // ISO date string for custom period start
  endDate?: string; // ISO date string for custom period end
}

interface UsageHistoryPeriod {
  periodStart: string; // ISO date string
  periodEnd: string; // ISO date string
  periodLabel: string; // "Jan 1 - Jan 31, 2025" format
  invoices: number;
  templates: number;
  members: number;
  storageBytes: number;
  storageMB: number;
}

interface GetUsageHistoryResponse {
  periods: UsageHistoryPeriod[];
  currentPeriod: {
    invoices: number;
    templates: number;
    members: number;
    storageBytes: number;
  };
}

/**
 * Calculate billing period dates based on subscription period start
 */
function calculateBillingPeriod(
  periodStart: Date,
  periodType: PeriodType,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();

  if (periodType === "custom" && customStart && customEnd) {
    return {
      start: new Date(customStart),
      end: new Date(customEnd),
    };
  }

  // Calculate current billing period
  const currentPeriodStart = periodStart ? new Date(periodStart) : new Date(now.getFullYear(), now.getMonth(), 1);
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  currentPeriodEnd.setDate(0); // Last day of month

  if (periodType === "previous") {
    // Previous billing period
    const prevPeriodStart = new Date(currentPeriodStart);
    prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);
    const prevPeriodEnd = new Date(currentPeriodStart);
    prevPeriodEnd.setDate(0); // Last day of previous month
    return { start: prevPeriodStart, end: prevPeriodEnd };
  }

  // Current period (default)
  return { start: currentPeriodStart, end: currentPeriodEnd };
}

/**
 * Get usage history for an organization grouped by billing periods
 */
export const getUsageHistory = onCall<GetUsageHistoryPayload, Promise<GetUsageHistoryResponse>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const {
        organizationId,
        periodType = "current",
        startDate,
        endDate,
      } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      if (periodType === "custom" && (!startDate || !endDate)) {
        throw new HttpsError("invalid-argument", "startDate and endDate are required for custom period");
      }

      logger.info("Fetching usage history", {
        organizationId,
        periodType,
        startDate,
        endDate,
      });

      // Get current organization
      const databaseService = getDatabaseService();
      const { getOrganizationRepository } = await import("../repositories/organization-repository");
      const organizationRepository = getOrganizationRepository(databaseService);
      const organization = await organizationRepository.get({ id: organizationId });

      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // Calculate billing period dates
      const billingPeriodEnd = organization.billing?.currentPeriodEnd
        ? new Date(organization.billing.currentPeriodEnd)
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      // Estimate period start as 30 days before period end
      const subscriptionPeriodStart = new Date(billingPeriodEnd);
      subscriptionPeriodStart.setDate(subscriptionPeriodStart.getDate() - 30);

      const { start: periodStart, end: periodEnd } = calculateBillingPeriod(
        subscriptionPeriodStart,
        periodType,
        startDate,
        endDate
      );

      // Calculate month range for querying aggregates
      const startMonth = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
      const endMonth = `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}`;

      // Import usage features
      const { USAGE_FEATURES } = await import("../usage/usage-features");

      // Fetch monthly aggregates for invoices
      const invoiceAggregates = await firestore()
        .collection("usage_aggregates_monthly")
        .where("orgId", "==", organizationId)
        .where("featureId", "==", USAGE_FEATURES.INVOICE_CREATE)
        .where("month", ">=", startMonth)
        .where("month", "<=", endMonth)
        .get();

      // Templates: Historical template counts not yet tracked in usage aggregates
      // We'll use organization.usage.templateCount for current period only
      // This can be enhanced later with proper template creation tracking

      // Storage: Use organization.usage.storageBytes for current period
      // Historical storage tracking would require a separate mechanism
      // For now, we'll use current storage value for all months

      // Build a map of month -> usage data
      const usageMap = new Map<string, {
        invoices: number;
        templates: number;
        storageBytes: number;
      }>();

      // Process invoice aggregates
      invoiceAggregates.docs.forEach((doc: any) => {
        const data = doc.data();
        const month = data.month as string;
        const current = usageMap.get(month) || { invoices: 0, templates: 0, storageBytes: 0 };
        current.invoices = data.totalCount || 0;
        usageMap.set(month, current);
      });

      // Templates: Use organization.usage.templateCount as current value
      // Historical template counts would require a separate tracking mechanism
      // For now, we'll use 0 for historical months and current count for current period

      // Storage: Use organization.usage.storageBytes for all periods
      // Historical storage tracking not yet implemented

      // Aggregate usage for the billing period
      // Sum all invoice counts from months within the period
      let totalInvoices = 0;
      for (const [month, usage] of usageMap.entries()) {
        if (month >= startMonth && month <= endMonth) {
          totalInvoices += usage.invoices;
        }
      }

      // Format period label
      const periodLabel = `${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

      // Create period data
      const periodData: UsageHistoryPeriod = {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        periodLabel,
        invoices: totalInvoices,
        templates: organization.usage.templateCount, // Current count (historical tracking not yet implemented)
        members: organization.memberIds.length,
        storageBytes: organization.usage.storageBytes, // Current value (historical tracking not yet implemented)
        storageMB: Math.round(organization.usage.storageBytes / (1024 * 1024)),
      };

      // Get current billing period usage (always return this for reference)
      const currentPeriod = {
        invoices: organization.usage.invoiceCount,
        templates: organization.usage.templateCount,
        members: organization.memberIds.length,
        storageBytes: organization.usage.storageBytes,
      };

      logger.info("Usage history fetched successfully", {
        organizationId,
        periodType,
        periodLabel: periodData.periodLabel,
      });

      return {
        periods: [periodData],
        currentPeriod,
      };
    } catch (error) {
      logger.error("Failed to fetch usage history", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to fetch usage history: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);


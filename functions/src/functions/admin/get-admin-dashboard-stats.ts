import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";

interface AdminDashboardStats {
  totalOrganizations: number;
  activeSubscriptions: number;
  newOrgsToday: number;
  totalMRR: number;
  totalUsage: {
    invoices: number;
    templates: number;
    storageMB: number;
  };
  systemHealth: {
    errorCount: number;
    failedWorkflows: number;
    activeAlerts: number;
  };
}

/**
 * Get admin dashboard statistics
 * Requires admin role
 */
export const getAdminDashboardStats = onCall<{}, Promise<AdminDashboardStats>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify admin auth
      await verifyAdminAuth(request, {
        requiredPermission: "organizations.read",
      });

      const db = getFirestore();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get total organizations
      const orgsSnapshot = await db.collection("organizations").get();
      const totalOrganizations = orgsSnapshot.size;

      // Get new orgs today
      const newOrgsSnapshot = await db
        .collection("organizations")
        .where("createdAt", ">=", todayStart)
        .get();
      const newOrgsToday = newOrgsSnapshot.size;

      // Get active subscriptions (organizations with active subscription status)
      // TODO: Integrate with Stripe to get actual subscription counts
      const activeSubscriptions = orgsSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.subscription?.status === "active" || data.stripeCustomerId;
      }).length;

      // Calculate MRR (Monthly Recurring Revenue)
      // TODO: Integrate with Stripe to get actual MRR
      const totalMRR = 0;

      // Get usage aggregates
      const invoicesSnapshot = await db.collection("invoices").get();
      const templatesSnapshot = await db.collection("templates").get();

      // Calculate storage (simplified - would need actual storage calculation)
      const storageMB = 0; // TODO: Calculate from storage metadata

      // Get system health metrics
      // TODO: Implement error tracking and workflow failure tracking
      const errorCount = 0;
      const failedWorkflows = 0;
      const activeAlerts = 0;

      const stats: AdminDashboardStats = {
        totalOrganizations,
        activeSubscriptions,
        newOrgsToday,
        totalMRR,
        totalUsage: {
          invoices: invoicesSnapshot.size,
          templates: templatesSnapshot.size,
          storageMB,
        },
        systemHealth: {
          errorCount,
          failedWorkflows,
          activeAlerts,
        },
      };

      loggerService.info("Admin dashboard stats retrieved", {
        adminId: request.auth?.uid,
        stats,
      });

      return stats;
    } catch (error) {
      loggerService.error("Error getting admin dashboard stats", {
        error: error instanceof Error ? error.message : String(error),
        adminId: request.auth?.uid,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to retrieve dashboard statistics"
      );
    }
  }
);


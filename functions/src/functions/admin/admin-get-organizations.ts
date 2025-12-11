import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";

interface Organization {
  id: string;
  name: string;
  createdAt: string;
  status: "active" | "suspended" | "deleted";
  memberCount: number;
  subscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "none";
  usageSummary: {
    invoices: number;
    templates: number;
    storageMB: number;
  };
}

interface AdminGetOrganizationsRequest {
  search?: string;
  limit?: number;
  offset?: number;
  status?: "active" | "suspended" | "deleted";
}

interface AdminGetOrganizationsResponse {
  organizations: Organization[];
  total: number;
}

/**
 * Get all organizations (admin only)
 * Requires admin role with organizations.read permission
 */
export const adminGetOrganizations = onCall<
  AdminGetOrganizationsRequest,
  Promise<AdminGetOrganizationsResponse>
>(
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
      const { search, limit = 100, offset = 0, status } = request.data || {};

      // Build query
      let query = db.collection("organizations") as FirebaseFirestore.Query;

      // Filter by status if provided
      if (status) {
        query = query.where("status", "==", status);
      }

      // Get all organizations (we'll filter by search in memory for now)
      // In production, you might want to use Algolia or similar for full-text search
      const snapshot = await query.get();

      let organizations: Organization[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const orgId = doc.id;

        // Filter by search term if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const nameMatch = data.name?.toLowerCase().includes(searchLower);
          const idMatch = orgId.toLowerCase().includes(searchLower);
          if (!nameMatch && !idMatch) {
            continue;
          }
        }

        // Get member count
        const memberIds = data.memberIds || [];
        const memberCount = memberIds.length;

        // Get usage summary
        const invoicesSnapshot = await db
          .collection("invoices")
          .where("orgId", "==", orgId)
          .get();
        const templatesSnapshot = await db
          .collection("templates")
          .where("orgId", "==", orgId)
          .get();

        // TODO: Calculate actual storage from storage metadata
        const storageMB = 0;

        organizations.push({
          id: orgId,
          name: data.name || "Unnamed Organization",
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          status: data.status || "active",
          memberCount,
          subscriptionStatus: data.subscription?.status || "none",
          usageSummary: {
            invoices: invoicesSnapshot.size,
            templates: templatesSnapshot.size,
            storageMB,
          },
        });
      }

      // Sort by createdAt (newest first)
      organizations.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const total = organizations.length;

      // Apply pagination
      const paginatedOrgs = organizations.slice(offset, offset + limit);

      loggerService.info("Admin retrieved organizations", {
        adminId: request.auth?.uid,
        count: paginatedOrgs.length,
        total,
        search,
      });

      return {
        organizations: paginatedOrgs,
        total,
      };
    } catch (error) {
      loggerService.error("Error getting organizations", {
        error: error instanceof Error ? error.message : String(error),
        adminId: request.auth?.uid,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to retrieve organizations"
      );
    }
  }
);


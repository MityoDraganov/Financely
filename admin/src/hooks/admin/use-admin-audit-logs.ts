import { useQuery } from "@tanstack/react-query";
import { AuditLog, AuditLogQueryFilters } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useAdminOrganizations } from "./use-admin-organizations";

const databaseService = serviceHost.getDatabaseService();
const auditLogRepository = repositoryHost.getAuditLogRepository(databaseService);

/**
 * Admin hook to fetch audit logs across all organizations
 * Aggregates logs from all organizations for admin view
 */
export function useAdminAuditLogs(filters?: Partial<AuditLogQueryFilters>) {
  const { data: organizations } = useAdminOrganizations();

  return useQuery<AuditLog[]>({
    queryKey: ["admin", "audit-logs", "all", filters],
    queryFn: async () => {
      if (!organizations || organizations.length === 0) {
        return [];
      }

      // Fetch logs from all organizations in parallel
      const allLogs: AuditLog[] = [];

      await Promise.all(
        organizations.map(async (org) => {
          try {
            const queryFilters: AuditLogQueryFilters = {
              organizationId: org.id,
              ...filters,
            };

            const result = await auditLogRepository.query(org.id, queryFilters, {
              limit: 100, // Limit per org to avoid too many results
              orderBy: { field: "timestamp", direction: "desc" },
            });

            allLogs.push(...result.logs);
          } catch (error) {
            console.error(`Failed to fetch audit logs for org ${org.id}:`, error);
            // Continue with other orgs
          }
        })
      );

      // Sort by timestamp descending (most recent first)
      allLogs.sort((a, b) => {
        const aTime = a.timestamp || a.createdAt || "";
        const bTime = b.timestamp || b.createdAt || "";
        return bTime.localeCompare(aTime);
      });

      // Apply global limit
      return allLogs.slice(0, 1000);
    },
    enabled: !!organizations && organizations.length > 0,
    staleTime: 30 * 1000,
  });
}


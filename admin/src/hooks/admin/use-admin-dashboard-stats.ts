import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useMemo } from "react";
import { Organization } from "@/core";

const databaseService = serviceHost.getDatabaseService();
const organizationRepository = repositoryHost.getOrganizationsRepository(databaseService);
const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

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
 * Admin hook to fetch dashboard statistics
 * Aggregates data from multiple repositories
 */
export function useAdminDashboardStats() {
  // Fetch all data in parallel
  const { data: organizations, isLoading: orgsLoading, refetch: refetchOrgs } = useQuery({
    queryKey: ["admin", "stats", "organizations"],
    queryFn: () =>
      organizationRepository.getAll({
        queryConstraints: [],
        pagination: { limit: 10000 },
      }),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });

  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["admin", "stats", "invoices"],
    queryFn: () =>
      invoiceRepository.getAll({
        queryConstraints: [],
        pagination: { limit: 1 }, // We only need count
      }),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });

  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ["admin", "stats", "templates"],
    queryFn: () =>
      templateRepository.getAll({
        queryConstraints: [],
        pagination: { limit: 1 }, // We only need count
      }),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });

  const isLoading = orgsLoading || invoicesLoading || templatesLoading;

  // Calculate stats
  const stats = useMemo<AdminDashboardStats | undefined>(() => {
    if (!organizations) return undefined;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count new orgs today
    const newOrgsToday = organizations.filter((org: Organization) => {
      const createdAt = org.createdAt;
      if (!createdAt) return false;
      const createdDate = typeof createdAt === 'string' 
        ? new Date(createdAt) 
        : (createdAt && typeof createdAt === 'object' && 'getTime' in createdAt
            ? createdAt as Date
            : new Date());
      return createdDate >= todayStart;
    }).length;

    // Count active subscriptions
    const activeSubscriptions = organizations.filter(
      (org: Organization) => org.subscription?.status === "active" || (org as any).stripeCustomerId
    ).length;

    // Calculate MRR (would need Stripe integration for real values)
    const totalMRR = 0; // TODO: Integrate with Stripe

    return {
      totalOrganizations: organizations.length,
      activeSubscriptions,
      newOrgsToday,
      totalMRR,
      totalUsage: {
        invoices: invoices?.length || 0,
        templates: templates?.length || 0,
        storageMB: 0, // TODO: Calculate from storage metadata
      },
      systemHealth: {
        errorCount: 0, // TODO: Implement error tracking
        failedWorkflows: 0, // TODO: Implement workflow tracking
        activeAlerts: 0, // TODO: Implement alerting
      },
    };
  }, [organizations, invoices, templates]);

  const refetch = () => {
    refetchOrgs();
    refetchInvoices();
    refetchTemplates();
  };

  return {
    data: stats,
    isLoading,
    refetch,
  };
}


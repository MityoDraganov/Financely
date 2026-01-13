import { UsageContext } from "../../core/entities/data-context";
import { ResolverContext } from "../data-source-registry";
import { getInvoiceRepository } from "../../repositories/invoice-repository";
import { getOrganizationRepository } from "../../repositories/organization-repository";

export async function resolveUsageSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ usage?: UsageContext }> {
  const organizationId = params.organizationId || ctx.organizationId;
  if (!organizationId) {
    return {};
  }

  const organizationRepository = getOrganizationRepository(ctx.databaseService);
  const organization = await organizationRepository.get({ id: organizationId });

  if (!organization) {
    return {};
  }

  const invoiceRepository = getInvoiceRepository(ctx.databaseService);
  const invoices = await invoiceRepository.getAll({
    queryConstraints: [{ field: "orgId", operator: "==", value: organizationId }],
    pagination: { limit: 1000 },
  });

  const invoiceCount = invoices.length;

  const lastActivity = organization.updatedAt || organization.createdAt;

  return {
    usage: {
      invoiceCount,
      emailCount: undefined,
      storageUsed: undefined,
      lastActivity: lastActivity || undefined,
    },
  };
}


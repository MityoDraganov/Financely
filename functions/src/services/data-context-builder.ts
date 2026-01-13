import { DataContext, createDataContext, DataContextValue } from "../core/entities/data-context";
import { ResolverContext } from "./data-source-registry";
import { DatabaseService } from "../core";
import { logger } from "firebase-functions";
import { resolveInvoiceSource } from "./data-sources/invoice-source";
import { resolveCustomerSource } from "./data-sources/customer-source";
import { resolveOrganizationSource } from "./data-sources/organization-source";
import { resolvePaymentSource } from "./data-sources/payment-source";
import { resolveUsageSource } from "./data-sources/usage-source";
import { dataSourceRegistry } from "./data-source-registry";
import { computedFieldsService } from "./computed-fields-service";
import { getExternalSourceConfigRepository } from "../repositories/external-source-config-repository";
import { externalConnectorRegistry } from "./data-sources/external/external-connector-registry";
import { externalSourceCacheService } from "./external-source-cache";
import { RestApiConnector } from "./data-sources/external/rest-api-connector";
import { GraphQLConnector } from "./data-sources/external/graphql-connector";
import { WebhookConnector } from "./data-sources/external/webhook-connector";

export interface BuildDataContextInput {
  include: string[];
  invoiceId?: string;
  customerId?: string;
  organizationId: string;
  paymentId?: string;
}

export async function buildDataContext(
  input: BuildDataContextInput,
  databaseService: DatabaseService
): Promise<DataContext> {
  const { include, invoiceId, customerId, organizationId, paymentId } = input;

  const resolverContext: ResolverContext = {
    databaseService,
    organizationId,
  };

  const context: Partial<DataContext> = {};
  const externalData: Record<string, Record<string, unknown>> = {};

  const internalSources: string[] = [];
  const externalSourceIds: string[] = [];

  for (const sourceKey of include) {
    if (sourceKey.startsWith("external:")) {
      externalSourceIds.push(sourceKey.replace("external:", ""));
    } else {
      internalSources.push(sourceKey);
    }
  }

  for (const sourceKey of internalSources) {
    const source = dataSourceRegistry.get(sourceKey);
    if (!source) {
      logger.warn(`Unknown data source: ${sourceKey}`);
      continue;
    }

    const params: Record<string, string> = {};
    if (sourceKey === "invoice" && invoiceId) {
      params.invoiceId = invoiceId;
    } else if (sourceKey === "customer" && customerId) {
      params.customerId = customerId;
    } else if (sourceKey === "organization") {
      params.organizationId = organizationId;
    } else if (sourceKey === "payment" && (invoiceId || paymentId)) {
      params.invoiceId = invoiceId || paymentId || "";
    } else if (sourceKey === "usage") {
      params.organizationId = organizationId;
    }

    const validation = dataSourceRegistry.validateParams(sourceKey, params);
    if (!validation.valid) {
      if (source.requiredParams.length > 0) {
        throw new Error(
          `Missing required parameters for data source "${sourceKey}": ${validation.missing.join(", ")}`
        );
      }
      continue;
    }

    try {
      const resolved = await source.resolve(params, resolverContext);
      Object.assign(context, resolved);
    } catch (error) {
      logger.error(`Failed to resolve data source "${sourceKey}"`, {
        error: error instanceof Error ? error.message : String(error),
        params,
      });
      if (source.requiredParams.length > 0) {
        throw error;
      }
    }
  }

  for (const externalSourceId of externalSourceIds) {
    try {
      const configRepository = getExternalSourceConfigRepository(databaseService);
      const config = await configRepository.get({ id: externalSourceId });

      if (!config) {
        logger.warn(`External source config not found: ${externalSourceId}`);
        continue;
      }

      if (config.orgId !== organizationId) {
        throw new Error(`External source ${externalSourceId} does not belong to organization ${organizationId}`);
      }

      if (!config.enabled || config.status !== "active") {
        logger.info(`External source ${externalSourceId} is not enabled or active`);
        continue;
      }

      let data: Record<string, unknown> | null = null;

      if (config.refreshStrategy === "on-demand" || config.refreshStrategy === "scheduled") {
        data = await externalSourceCacheService.get(externalSourceId) as Record<string, unknown> | null;

        if (!data) {
          const connector = externalConnectorRegistry.create(config);
          const fetched = await connector.fetch();
          data = fetched as Record<string, unknown>;

          const ttl = config.cacheConfig?.ttl || 300;
          await externalSourceCacheService.set(externalSourceId, fetched, ttl);
        }
      } else if (config.refreshStrategy === "event-driven") {
        data = await externalSourceCacheService.get(externalSourceId) as Record<string, unknown> | null;
      }

      if (data) {
        externalData[config.name] = data;
      }
    } catch (error) {
      logger.error(`Failed to resolve external source "${externalSourceId}"`, {
        error: error instanceof Error ? error.message : String(error),
        externalSourceId,
      });
    }
  }

  const meta = {
    locale: context.organization?.settings?.defaultLanguage || "en",
    currency: context.organization?.settings?.defaultCurrency || "USD",
    timezone: context.organization?.settings?.defaultTimezone || "UTC",
  };

  const partialContext = createDataContext({
    ...context,
    meta,
  });

  const computed = computedFieldsService.computeAll(partialContext);

  return createDataContext({
    ...context,
    external: Object.keys(externalData).length > 0 
      ? Object.fromEntries(
          Object.entries(externalData).map(([key, value]) => [
            key,
            Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, v as DataContextValue])
            )
          ])
        )
      : undefined,
    computed,
    meta,
  });
}

export function initializeDataSources(): void {
  dataSourceRegistry.register({
    key: "invoice",
    description: "Invoice with items and totals",
    requiredParams: ["invoiceId"],
    resolve: resolveInvoiceSource,
  });

  dataSourceRegistry.register({
    key: "customer",
    description: "Customer profile data",
    requiredParams: ["customerId"],
    resolve: resolveCustomerSource,
  });

  dataSourceRegistry.register({
    key: "organization",
    description: "Organization settings and branding",
    requiredParams: ["organizationId"],
    resolve: resolveOrganizationSource,
  });

  dataSourceRegistry.register({
    key: "payment",
    description: "Payment information from invoice",
    requiredParams: ["invoiceId"],
    resolve: resolvePaymentSource,
  });

  dataSourceRegistry.register({
    key: "usage",
    description: "Organization usage statistics",
    requiredParams: ["organizationId"],
    resolve: resolveUsageSource,
  });

  externalConnectorRegistry.register("rest-api", (config) => new RestApiConnector(config));
  externalConnectorRegistry.register("graphql", (config) => new GraphQLConnector(config));
  externalConnectorRegistry.register("webhook", (config) => new WebhookConnector(config));
}


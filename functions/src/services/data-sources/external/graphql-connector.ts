import { ExternalConnectorBase } from "./external-connector-base";
import { DataContextValue } from "../../../core/entities/data-context";

export class GraphQLConnector extends ExternalConnectorBase {
  async fetch(): Promise<Record<string, DataContextValue>> {
    if (!this.config.query) {
      throw new Error("GraphQL connector requires a query");
    }

    const query = typeof this.config.query === "string"
      ? this.config.query
      : JSON.stringify(this.config.query);

    const rawData = await this.retryWithBackoff(async () => {
      return await this.makeRequest(this.config.endpoint, {
        method: "POST",
        body: {
          query,
          variables: this.config.headers || {},
        },
      });
    });

    const graphqlData = rawData as { data?: unknown; errors?: unknown[] };
    if (graphqlData.errors && graphqlData.errors.length > 0) {
      throw new Error(`GraphQL errors: ${JSON.stringify(graphqlData.errors)}`);
    }

    return this.normalizeData(graphqlData.data || rawData, this.config.schemaMapping);
  }
}


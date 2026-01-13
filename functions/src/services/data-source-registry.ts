import { DataContext } from "../core/entities/data-context";
import { DatabaseService } from "../core";

export interface ResolverContext {
  databaseService: DatabaseService;
  organizationId: string;
}

export interface DataSourceDefinition {
  key: string;
  description: string;
  requiredParams: string[];
  resolve: (params: Record<string, string>, ctx: ResolverContext) => Promise<Partial<DataContext>>;
}

export class DataSourceRegistry {
  private sources: Map<string, DataSourceDefinition> = new Map();

  register(source: DataSourceDefinition): void {
    if (this.sources.has(source.key)) {
      throw new Error(`Data source with key "${source.key}" is already registered`);
    }
    this.sources.set(source.key, source);
  }

  get(key: string): DataSourceDefinition | undefined {
    return this.sources.get(key);
  }

  getAll(): DataSourceDefinition[] {
    return Array.from(this.sources.values());
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }

  validateParams(key: string, params: Record<string, string>): { valid: boolean; missing: string[] } {
    const source = this.sources.get(key);
    if (!source) {
      return { valid: false, missing: [] };
    }

    const missing: string[] = [];
    for (const requiredParam of source.requiredParams) {
      if (!(requiredParam in params) || !params[requiredParam]) {
        missing.push(requiredParam);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

export const dataSourceRegistry = new DataSourceRegistry();


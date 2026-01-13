import { ExternalSourceConfig } from "../../../core/entities/external-source-config";
import { ExternalConnectorBase } from "./external-connector-base";

export type ExternalConnectorFactory = (config: ExternalSourceConfig) => ExternalConnectorBase;

export class ExternalConnectorRegistry {
  private factories: Map<string, ExternalConnectorFactory> = new Map();

  register(type: string, factory: ExternalConnectorFactory): void {
    if (this.factories.has(type)) {
      throw new Error(`External connector type "${type}" is already registered`);
    }
    this.factories.set(type, factory);
  }

  create(config: ExternalSourceConfig): ExternalConnectorBase {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`Unknown external connector type: ${config.type}`);
    }
    return factory(config);
  }

  has(type: string): boolean {
    return this.factories.has(type);
  }

  getSupportedTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}

export const externalConnectorRegistry = new ExternalConnectorRegistry();


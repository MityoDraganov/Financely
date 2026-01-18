import { DuplicationOptions } from "../../../core/entities/duplication-mode";

/**
 * Base Duplicator
 * 
 * Provides common functionality for entity duplication.
 */
export abstract class BaseDuplicator<TEntity, TEntityData> {
  /**
   * Duplicate an entity
   */
  abstract duplicate(
    entity: TEntity,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: TEntityData; newId: string }>;

  /**
   * Reset identity-bound fields
   */
  abstract resetIdentityFields(
    data: TEntityData,
    targetOrgId: string,
    createdBy: string,
  ): TEntityData;

  /**
   * Resolve references to other entities
   */
  abstract resolveReferences(
    data: TEntityData,
    idMapping: IdMappingTable,
  ): TEntityData;

  /**
   * Handle conflicts (name, slug, etc.)
   */
  abstract handleConflict(
    data: TEntityData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): TEntityData;

  /**
   * Generate conflict suffix
   */
  protected generateConflictSuffix(value: string, options: DuplicationOptions): string {
    if (options.conflictResolution === "skip") {
      return value;
    }
    if (options.conflictResolution === "user_input" && options.customSuffix) {
      return `${value} ${options.customSuffix}`;
    }
    // Default: suffix
    return `${value} (Copy)`;
  }
}

/**
 * Simple ID mapping table for tracking old → new entity IDs
 */
export class IdMappingTable {
  private mappings = new Map<string, { newId: string; entityType: string }>();

  addMapping(oldId: string, newId: string, entityType: string): void {
    this.mappings.set(oldId, { newId, entityType });
  }

  getNewId(oldId: string): string | undefined {
    return this.mappings.get(oldId)?.newId;
  }

  getMapping(oldId: string): { newId: string; entityType: string } | undefined {
    return this.mappings.get(oldId);
  }

  hasMapping(oldId: string): boolean {
    return this.mappings.has(oldId);
  }
}

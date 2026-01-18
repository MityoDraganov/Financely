import { Product, ProductData } from "../../../core/entities/product";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class ProductDuplicator extends BaseDuplicator<Product, ProductData> {
  async duplicate(
    entity: Product,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: ProductData; newId: string }> {
    const entityData: ProductData = {
      organizationId: entity.organizationId,
      name: entity.name,
      description: entity.description,
      price: options.includePrices ? entity.price : 0,
      currency: entity.currency,
      sku: entity.sku,
      barcode: entity.barcode,
      stockQuantity: entity.stockQuantity,
      trackInventory: entity.trackInventory,
      lowStockThreshold: entity.lowStockThreshold,
      images: entity.images,
      category: entity.category,
      tags: entity.tags,
      weight: entity.weight,
      dimensions: entity.dimensions,
      status: entity.status,
      taxRate: entity.taxRate,
      ...(options.includePrices && entity.cost !== undefined ? { cost: entity.cost } : {}),
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: "" };
  }

  resetIdentityFields(
    data: ProductData,
    targetOrgId: string,
    createdBy: string,
  ): ProductData {
    return {
      ...data,
      organizationId: targetOrgId,
      stockQuantity: 0,
      status: "active",
    };
  }

  resolveReferences(
    data: ProductData,
    idMapping: IdMappingTable,
  ): ProductData {
    return data;
  }

  handleConflict(
    data: ProductData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): ProductData {
    if (conflictType === "name") {
      return {
        ...data,
        name: this.generateConflictSuffix(data.name, options),
      };
    }
    if (conflictType === "sku" && data.sku) {
      return {
        ...data,
        sku: `${data.sku}-copy`,
      };
    }
    return data;
  }
}

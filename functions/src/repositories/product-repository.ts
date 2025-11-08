import { DatabaseService } from "../core";
import { Product, ProductData } from "../core/entities/product";
import { ProductRepository } from "../core/ports/repositories/product-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a ProductRepository backed by the provided DatabaseService.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ProductRepository} Repository with CRUD operations for products.
 */
export function getProductRepository(
  databaseService: DatabaseService,
): ProductRepository {
  return getGenericRepository<Product, ProductData>(
    () => DatabaseCollection.PRODUCTS,
    databaseService,
  );
}


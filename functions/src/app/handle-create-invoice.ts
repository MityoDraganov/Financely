import { CreateInvoiceInput, invoiceDataSchema, InvoiceDataValue } from "../core/entities/invoice";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getProductRepository } from "../repositories/product-repository";
import { loggerService } from "../services/logger-service";
import {
  loadLiveTemplateSnapshot,
  loadTemplateSnapshotFromVersionId,
} from "../services/invoice-template-snapshot-service";
import { ZodError } from "zod";

/**
 * Application handler for creating an invoice.
 *
 * This handler:
 * 1. Validates the incoming payload against the dynamic invoice schema
 * 2. Creates the invoice in the database
 * 3. Deducts product quantities if productId is provided and tracking is enabled
 * 4. Returns the created invoice ID
 *
 * @param {CreateInvoiceInput & { productId?: string }} payload - The invoice creation payload with dynamic data
 * @return {Promise<string>} The created invoice ID
 * @throws Error if validation fails or database operation fails
 */
export async function handleCreateInvoice(
  payload: CreateInvoiceInput & { productIds?: string[] }
): Promise<string> {
  try {
    // Validate the payload
    const validatedData = invoiceDataSchema.parse(payload);
    const normalizedPaidAt =
      validatedData.status === "paid"
        ? validatedData.paidAt || new Date().toISOString()
        : undefined;

    // Get database service and repository
    const databaseService = getDatabaseService();
    const invoiceRepository = getInvoiceRepository(databaseService);

    // Freeze template at creation-time so future template edits/deletes do not affect this invoice.
    let templateSnapshot;
    if (validatedData.templateVersionId) {
      templateSnapshot = await loadTemplateSnapshotFromVersionId({
        databaseService,
        templateVersionId: validatedData.templateVersionId,
        templateId: validatedData.templateId,
        orgId: validatedData.orgId,
      });

      if (!templateSnapshot) {
        throw new Error(`Template version not found: ${validatedData.templateVersionId}`);
      }
    } else {
      templateSnapshot = await loadLiveTemplateSnapshot({
        templateId: validatedData.templateId,
        orgId: validatedData.orgId,
      });

      if (!templateSnapshot) {
        throw new Error(`Template not found: ${validatedData.templateId}`);
      }
    }

    // Create the invoice
    // Note: repository.create returns the document ID as a string
    const invoiceId = await invoiceRepository.create({
      data: {
        ...validatedData,
        paidAt: normalizedPaidAt,
        templateSnapshot,
      },
    });

    if (!invoiceId) {
      throw new Error("Failed to create invoice: No ID returned");
    }

    // Deduct product quantities if productIds are provided
    if (payload.productIds && payload.productIds.length > 0) {
      try {
        await deductProductQuantitiesForItems(
          payload.productIds,
          validatedData.data,
          databaseService
        );
      } catch (error) {
        // Log error but don't fail invoice creation
        loggerService.warn("Failed to deduct product quantities", {
          error: error instanceof Error ? error.message : "Unknown error",
          productIds: payload.productIds,
          invoiceId,
        });
      }
    }

    return invoiceId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Invoice validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}

/**
 * Deduct product quantities from invoice items
 * Supports multiple products (one per item)
 */
async function deductProductQuantitiesForItems(
  productIds: string[],
  invoiceData: Record<string, InvoiceDataValue>,
  databaseService: ReturnType<typeof getDatabaseService>
): Promise<void> {
  const productRepository = getProductRepository(databaseService);
  
  // Extract items from invoice data
  const items = extractItemsFromInvoiceData(invoiceData);
  
  if (!items || items.length === 0) {
    loggerService.info("No items found in invoice data, skipping quantity deduction");
    return;
  }

  // Process each product ID (should correspond to items by index)
  // Note: productIds array may be shorter than items array if not all items have products
  // We iterate through items and check if there's a corresponding productId
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const productId = i < productIds.length ? productIds[i] : undefined;
    
    if (!productId || typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    try {
      // Fetch product
      const product = await productRepository.get({ id: productId });
      if (!product) {
        loggerService.warn("Product not found for quantity deduction", { productId, itemIndex: i });
        continue;
      }

      // Check if inventory tracking is enabled
      if (!product.trackInventory || product.stockQuantity === undefined) {
        loggerService.info("Product inventory tracking not enabled, skipping quantity deduction", {
          productId,
          productName: product.name,
          trackInventory: product.trackInventory,
        });
        continue;
      }

      // Extract quantity (support both "qty" and "quantity" fields)
      const qty = Number(item.qty || item.quantity || 0);
      if (qty <= 0) {
        loggerService.info("Item quantity is zero or negative, skipping quantity deduction", {
          productId,
          productName: product.name,
          quantity: qty,
        });
        continue;
      }

      // Check if sufficient stock is available
      if (product.stockQuantity < qty) {
        throw new Error(
          `Insufficient stock for ${product.name}: Product has ${product.stockQuantity} units, but invoice requires ${qty} units`
        );
      }

      // Deduct quantity
      const newStockQuantity = product.stockQuantity - qty;
      await productRepository.update({
        id: productId,
        data: { stockQuantity: newStockQuantity },
      });

      // Invalidate brand context cache (product stock changed)
      const { getBrandContextCache } = await import("../services/brand-context-cache");
      const cache = getBrandContextCache();
      cache.invalidate(product.organizationId);

      loggerService.info("Product quantity deducted successfully", {
        productId,
        productName: product.name,
        quantityDeducted: qty,
        previousStock: product.stockQuantity,
        newStock: newStockQuantity,
        itemIndex: i,
      });
    } catch (error) {
      loggerService.error("Failed to deduct quantity for product", {
        error: error instanceof Error ? error.message : "Unknown error",
        productId,
        itemIndex: i,
      });
      // Continue processing other products even if one fails
    }
  }
}

/**
 * Extract items array from invoice data
 * Supports various possible locations and structures
 */
function extractItemsFromInvoiceData(
  invoiceData: Record<string, InvoiceDataValue>
): Array<Record<string, InvoiceDataValue>> | null {
  // Try common locations for items array
  const possiblePaths = ["items", "lineItems", "invoiceItems"];
  
  for (const path of possiblePaths) {
    const value = invoiceData[path];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, InvoiceDataValue> =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      );
    }
  }

  // Try nested paths (e.g., data.items)
  for (const key in invoiceData) {
    const value = invoiceData[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedItems = extractItemsFromInvoiceData(
        value as Record<string, InvoiceDataValue>
      );
      if (nestedItems && nestedItems.length > 0) {
        return nestedItems;
      }
    }
  }

  return null;
}

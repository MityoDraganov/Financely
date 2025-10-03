import { CreateInvoiceInput, invoiceDataSchema } from "../core/entities/invoice";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { ZodError } from "zod";

/**
 * Application handler for creating an invoice.
 *
 * This handler:
 * 1. Validates the incoming payload against the dynamic invoice schema
 * 2. Creates the invoice in the database
 * 3. Returns the created invoice ID
 *
 * @param {CreateInvoiceInput} payload - The invoice creation payload with dynamic data
 * @return {Promise<string>} The created invoice ID
 * @throws Error if validation fails or database operation fails
 */
export async function handleCreateInvoice(
  payload: CreateInvoiceInput
): Promise<string> {
  try {
    // Validate the payload
    const validatedData = invoiceDataSchema.parse(payload);

    // Get database service and repository
    const databaseService = getDatabaseService();
    const invoiceRepository = getInvoiceRepository(databaseService);

    // Create the invoice
    // Note: repository.create returns the document ID as a string
    const invoiceId = await invoiceRepository.create({ data: validatedData });

    if (!invoiceId) {
      throw new Error("Failed to create invoice: No ID returned");
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


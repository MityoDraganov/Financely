import { DatabaseService} from "../core";
import { Invoice, InvoiceData } from "../core/entities/invoice";
import { InvoiceRepository } from "../core/ports/repositories/invoice-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `ProposalRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {ProposalRepository} Repository with CRUD operations for proposals.
 */
export function getInvoiceRepository(
  databaseService: DatabaseService,
): InvoiceRepository {
  return getGenericRepository<Invoice, InvoiceData>(
    () => DatabaseCollection.INVOICES,
    databaseService,
  );
}

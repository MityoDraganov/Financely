import { Invoice, InvoiceData } from "../../entities/invoice";
import { GenericRepository } from "./generic-repository";

export type InvoiceRepository = GenericRepository<Invoice, InvoiceData>;

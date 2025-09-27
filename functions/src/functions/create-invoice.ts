import { onCall } from "firebase-functions/https";
import { serviceHost } from "../services";
import { repositoryHost } from "../repositories";
import { handleCreateInvoice } from "../app/handle-create-invoice";

interface Payload {
	seller: {
		name: string;
		address: string;
		taxIdVat: string;
	};
	buyer: {
		name: string;
		address: string;
		taxIdVat: string;
	};
	invoiceNumber: string;
	issueDate: string;
	dueDate: string;
	items: Array<{
		description: string;
		qty: number;
		unitPrice: number;
	}>;
	paymentTerms: string;
	iban: string;
	vatRatePct?: number;
}

export const createInvoice = onCall<Payload>(
	{
		invoker: "public", // Allow public access (authentication handled internally)
		ingressSettings: "ALLOW_ALL", // Allow all ingress traffic
	},
	async (request) => {
		const { data } = request;
		const loggerService = serviceHost.getLoggerService();
		const databaseService = serviceHost.getDatabaseService();
		const invoiceRepository =
			repositoryHost.getInvoiceRepository(databaseService);
		const invoiceId = await handleCreateInvoice(
			{
				seller: data.seller,
				buyer: data.buyer,
				invoiceNumber: data.invoiceNumber,
				issueDate: data.issueDate,
				dueDate: data.dueDate,
				items: data.items,
				paymentTerms: data.paymentTerms,
				iban: data.iban,
				vatRatePct: data.vatRatePct,
			},
			{ loggerService, invoiceRepository }
		);
		return invoiceId;
	}
);

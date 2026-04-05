import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceData } from "@/core/entities/invoice";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);

export const useInvoices = (orgId?: string) => {
    return useQuery({
        queryKey: ["invoices", "get", orgId],
        queryFn: () => {
            if (orgId) {
                return invoiceRepository.getAll({
                    queryConstraints: [
                        { field: "orgId", operator: "==", value: orgId }
                    ],
                    orderBy: { field: "updatedAt", direction: "desc" }
                });
            }
            return invoiceRepository.getAll({
                orderBy: { field: "updatedAt", direction: "desc" }
            });
        },
        enabled: !!orgId, // Only fetch if orgId is provided
    });
};

export const useUpdateInvoice = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceData> }) => {
            return invoiceRepository.update({ id, data });
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["invoices", id] });
        },
    });
};




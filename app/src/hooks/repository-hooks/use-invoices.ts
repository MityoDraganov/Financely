import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery } from "@tanstack/react-query";

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





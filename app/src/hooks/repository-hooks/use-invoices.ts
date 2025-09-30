import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);

export const useInvoices = () => {
    return useQuery({
        queryKey: ["invoices", "get"],
        queryFn: () => invoiceRepository.getAll({}),
    });
};





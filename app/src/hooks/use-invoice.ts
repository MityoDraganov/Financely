import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

type CreateInvoiceParams = Parameters<typeof functionsService.createInvoice>[0];

export const useCreateInvoice = () => {
    const queryClient = useQueryClient();

    return useMutation<string, Error, CreateInvoiceParams>({
        mutationKey: ["invoices", "create"],
        mutationFn: async (params: CreateInvoiceParams) => {
            const result = await functionsService.createInvoice(params);
            return result.id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices", "get"] });
        },
    });
};

// Backwards-compat alias based on requested name
export const useCreateProduct = useCreateInvoice;

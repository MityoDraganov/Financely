import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

export const useCreateInvoice = () => {
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationKey: ["invoices", "create"],
      mutationFn: functionsService.createInvoice,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      },
    });
  };

export const useCreateProduct = useCreateInvoice;

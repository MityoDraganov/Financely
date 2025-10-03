import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

/**
 * Hook to create a new invoice
 */
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

/**
 * Hook to render an invoice as PDF
 */
export const useRenderInvoicePdf = () => {
  return useMutation({
    mutationKey: ["invoices", "renderPdf"],
    mutationFn: functionsService.renderInvoicePdf,
  });
};

/**
 * Hook to send an invoice via email
 */
export const useSendInvoiceEmail = () => {
  return useMutation({
    mutationKey: ["invoices", "sendEmail"],
    mutationFn: functionsService.sendInvoiceEmail,
  });
};

/**
 * Hook to generate a shareable link for an invoice
 */
export const useGenerateInvoiceShareLink = () => {
  return useMutation({
    mutationKey: ["invoices", "generateShareLink"],
    mutationFn: functionsService.generateInvoiceShareLink,
  });
};
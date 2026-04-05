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
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["invoices", "sendEmail"],
    mutationFn: functionsService.sendInvoiceEmail,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      if (variables?.invoiceId) {
        queryClient.invalidateQueries({ queryKey: ["invoices", variables.invoiceId] });
      }
    },
  });
};

/**
 * Hook to preview invoice email as a send-time snapshot
 */
export const usePreviewInvoiceEmail = () => {
  return useMutation({
    mutationKey: ["invoices", "previewEmail"],
    mutationFn: functionsService.previewInvoiceEmail,
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

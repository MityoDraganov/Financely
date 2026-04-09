import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

export const useCreateCommercialCaseFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["commercialCases", "create"],
    mutationFn: functionsService.createCommercialCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
    },
  });
};

export const useAdvanceCommercialCaseStageFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["commercialCases", "advanceStage"],
    mutationFn: functionsService.advanceCommercialCaseStage,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", variables.commercialCaseId],
      });
    },
  });
};

export const useOverrideCommercialCaseStageFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["commercialCases", "overrideStage"],
    mutationFn: functionsService.overrideCommercialCaseStage,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["commercialCases"] });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", variables.commercialCaseId],
      });
    },
  });
};

export const useCreateProposalForCaseFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["proposals", "createForCase"],
    mutationFn: functionsService.createProposalForCase,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({
        queryKey: ["proposals", "commercialCase", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", variables.commercialCaseId],
      });
    },
  });
};

export const useCreateInvoiceForCaseFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["invoices", "createForCase"],
    mutationFn: functionsService.createInvoiceForCase,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({
        queryKey: ["invoices", "commercialCase", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", variables.commercialCaseId],
      });
    },
  });
};

export const useConvertProposalToInvoiceForCaseFn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["proposals", "convertForCase"],
    mutationFn: functionsService.convertProposalToInvoiceForCase,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({
        queryKey: ["commercialCases", variables.commercialCaseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commercialCaseEvents", variables.commercialCaseId],
      });
    },
  });
};

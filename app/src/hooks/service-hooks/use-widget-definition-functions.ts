import { useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";

const functionsService = serviceHost.getFunctionsService();

export const useDeleteWidgetDefinition = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			payload: Parameters<typeof functionsService.deleteWidgetDefinition>[0],
		) => functionsService.deleteWidgetDefinition(payload),
		onSuccess: (_result, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", variables.organizationId],
			});
		},
	});
};

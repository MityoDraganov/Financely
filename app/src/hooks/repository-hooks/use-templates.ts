import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

export const useTemplates = () => {
	return useQuery({
		queryKey: ["templates"],
		queryFn: () => templateRepository.getAll({}),
	});
};

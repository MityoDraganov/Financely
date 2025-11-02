import { ContactData, QueryConstraint } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const databaseService = serviceHost.getDatabaseService();
const contactRepository = repositoryHost.getContactsRepository(databaseService);

/**
 * Hook to fetch all contacts (optionally filtered by constraints)
 */
export const useContacts = (queryConstraints?: QueryConstraint[]) => {
  return useQuery({
    queryKey: ["contacts", "all", queryConstraints],
    queryFn: () => contactRepository.getAll({ queryConstraints: queryConstraints || [] }),
  });
};

/**
 * Hook to fetch contacts by organization ID
 */
export const useContactsByOrg = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ["contacts", "org", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      return contactRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: orgId },
        ],
      });
    },
    enabled: !!orgId,
  });
};

/**
 * Hook to fetch a single contact by ID
 */
export const useContact = (contactId: string | undefined) => {
  return useQuery({
    queryKey: ["contacts", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      return contactRepository.get({ id: contactId });
    },
    enabled: !!contactId,
  });
};

/**
 * Hook to create a new contact
 */
export const useCreateContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ContactData) => {
      return contactRepository.create({ data });
    },
    onSuccess: (_contactId, variables) => {
      // Invalidate and refetch contacts queries
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      
      // If we have organizationId, also invalidate org-specific queries
      if (variables.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["contacts", "org", variables.organizationId] 
        });
      }
    },
  });
};

/**
 * Hook to update an existing contact
 */
export const useUpdateContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactData> }) => {
      return contactRepository.update({ id, data });
    },
    onSuccess: (_, { id, data }) => {
      // Invalidate and refetch contacts queries
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      
      // If we have organizationId, also invalidate org-specific queries
      if (data.organizationId) {
        queryClient.invalidateQueries({ 
          queryKey: ["contacts", "org", data.organizationId] 
        });
      }
    },
  });
};

/**
 * Hook to delete a contact
 */
export const useDeleteContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      return contactRepository.delete({ id: contactId });
    },
    onSuccess: (_, contactId) => {
      // Invalidate and refetch contacts queries
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.removeQueries({ queryKey: ["contacts", contactId] });
    },
  });
};

/**
 * Hook to search contacts by name or email
 */
export const useSearchContacts = (orgId: string | undefined, searchTerm: string) => {
  return useQuery({
    queryKey: ["contacts", "search", orgId, searchTerm],
    queryFn: async () => {
      if (!orgId || !searchTerm.trim()) return [];
      
      // Search by first name, last name, or email
      const contacts = await contactRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: orgId },
        ],
      });
      
      const searchLower = searchTerm.toLowerCase();
      return contacts.filter(contact => {
        const firstName = contact.data.firstName.toLowerCase();
        const lastName = contact.data.lastName.toLowerCase();
        const email = contact.data.email.toLowerCase();
        const company = contact.data.company?.toLowerCase() || "";
        
        return firstName.includes(searchLower) ||
               lastName.includes(searchLower) ||
               email.includes(searchLower) ||
               company.includes(searchLower);
      });
    },
    enabled: !!orgId && !!searchTerm.trim(),
  });
};

import { useEffect, useRef } from "react";
import { useLeadsByOrg } from "./repository-hooks/use-leads";
import { useCurrentOrganization } from "./use-current-organization";
import { useGenerateProposalSuggestion } from "./service-hooks/use-proposal-generation";
import { useCreateProposal } from "./repository-hooks/use-proposals";

/**
 * Hook that automatically generates proposal suggestions for new leads
 * when the organization has auto-suggestions enabled
 */
export function useAutoProposalSuggestions() {
  const { data: organization } = useCurrentOrganization();
  const { data: leads = [] } = useLeadsByOrg(organization?.id);
  const generateMutation = useGenerateProposalSuggestion();
  const createMutation = useCreateProposal();
  const processedLeadsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Check if auto-suggestions are enabled
    const autoSuggestionsEnabled = organization?.settings?.ai?.autoProposalSuggestions ?? false;
    
    if (!autoSuggestionsEnabled || !organization) {
      return;
    }

    // Find new leads (status === "new") that haven't been processed yet
    const newLeads = leads.filter((lead) => {
      const leadData = lead.data || lead;
      const isNew = leadData.status === "new";
      const notProcessed = !processedLeadsRef.current.has(lead.id);
      return isNew && notProcessed;
    });

    // Process each new lead
    newLeads.forEach(async (lead) => {
      // Mark as processed immediately to avoid duplicate processing
      processedLeadsRef.current.add(lead.id);

      try {
        // Check if a proposal already exists for this lead
        // This is a simple check - in production you might want to query proposals
        // For now, we'll just try to generate and let it fail gracefully if needed
        
        // Generate proposal suggestion
        const suggestion = await generateMutation.mutateAsync({
          leadId: lead.id,
          organizationId: organization.id,
        });

        // Automatically save the suggestion as a draft proposal
        await createMutation.mutateAsync(suggestion);
        
        // Success - proposal created
        console.log(`Auto-generated proposal for lead: ${lead.id}`);
      } catch (error) {
        // Remove from processed set so it can be retried
        processedLeadsRef.current.delete(lead.id);
        console.error(`Failed to auto-generate proposal for lead ${lead.id}:`, error);
        // Don't show toast for auto-generated failures to avoid spam
      }
    });
  }, [leads, organization, generateMutation, createMutation]);
}


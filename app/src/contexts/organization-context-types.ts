import { createContext } from "react";
import { Organization } from "@/core";

export interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  error: Error | null;
  switchOrganization: (organizationId: string) => void;
}

export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);


import { useContext } from "react";
import { OrganizationContext } from "@/contexts/organization-context-types";

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganizationContext must be used within an OrganizationProvider");
  }
  return context;
}


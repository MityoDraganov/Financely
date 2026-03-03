import type { Organization } from "@/core/entities/organization";

function formatOrganizationAddress(org: Organization | undefined): string {
  const address = org?.settings?.address;
  if (!address) return "";

  return [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}

/**
 * Returns a user-friendly preview/default value for well-known invoice bindings
 * based on the current organization data.
 */
export function getDesignerDefaultValueForBinding(
  binding: string | undefined,
  org: Organization | undefined,
): string | undefined {
  if (!binding) return undefined;
  const key = binding.toLowerCase();

  if (key === "seller.name" || key === "supplier.name") {
    return org?.name || undefined;
  }

  if (key === "seller.address" || key === "supplier.address") {
    const formatted = formatOrganizationAddress(org);
    return formatted || undefined;
  }

  return undefined;
}


import { OrganizationContext } from "../../core/entities/data-context";
import { ResolverContext } from "../data-source-registry";
import { getOrganizationRepository } from "../../repositories/organization-repository";
import { Organization } from "../../core/entities/organization";

export async function resolveOrganizationSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ organization?: OrganizationContext }> {
  const organizationId = params.organizationId || ctx.organizationId;
  if (!organizationId) {
    return {};
  }

  const organizationRepository = getOrganizationRepository(ctx.databaseService);
  const organization = await organizationRepository.get({ id: organizationId });

  if (!organization) {
    return {};
  }

  return {
    organization: mapOrganizationToContext(organization),
  };
}

function mapOrganizationToContext(organization: Organization): OrganizationContext {
  return {
    id: organization.id,
    name: organization.name,
    description: organization.description,
    logoUrl: organization.logoUrl,
    website: organization.website,
    settings: organization.settings
      ? {
          defaultCurrency: organization.settings.defaultCurrency,
          defaultLanguage: organization.settings.defaultLanguage,
          defaultTimezone: organization.settings.defaultTimezone,
          country: organization.settings.country,
          region: organization.settings.region,
          address: organization.settings.address
            ? {
                street: organization.settings.address.street,
                city: organization.settings.address.city,
                state: organization.settings.address.state,
                zipCode: organization.settings.address.zipCode,
                country: organization.settings.address.country,
              }
            : undefined,
          email: organization.settings.email,
          phone: organization.settings.phone,
          brandColors: organization.settings.brandColors
            ? {
                primary: organization.settings.brandColors.primary,
                secondary: organization.settings.brandColors.secondary,
                accent: organization.settings.brandColors.accent,
              }
            : undefined,
          branding: organization.settings.branding
            ? {
                customLogo: organization.settings.branding.customLogo,
                companyName: organization.settings.branding.companyName,
                emailFromName: organization.settings.branding.emailFromName,
                emailFromAddress: organization.settings.branding.emailFromAddress,
              }
            : undefined,
        }
      : undefined,
  };
}


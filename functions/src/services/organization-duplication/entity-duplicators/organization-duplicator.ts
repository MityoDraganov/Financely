import { Organization, OrganizationData } from "../../../core/entities/organization";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class OrganizationDuplicator extends BaseDuplicator<Organization, OrganizationData> {
  async duplicate(
    entity: Organization,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: OrganizationData; newId: string }> {
    const entityData: OrganizationData = {
      name: entity.name,
      description: entity.description,
      ...(entity.logoUrl && { logoUrl: entity.logoUrl }),
      website: entity.website,
      memberIds: [],
      status: "active",
      billing: {
        status: "incomplete",
        cancelAtPeriodEnd: false,
        entitlements: {},
      },
      settings: {
        ...entity.settings,
        ...(entity.settings?.branding && {
          branding: (() => {
            const { customDomain, emailFromAddress, ...brandingWithoutIdentity } = entity.settings.branding;
            return brandingWithoutIdentity;
          })(),
        }),
      },
      usage: {
        templateCount: 0,
        invoiceCount: 0,
        memberCount: 0,
        storageBytes: 0,
      },
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: targetOrgId };
  }

  resetIdentityFields(
    data: OrganizationData,
    targetOrgId: string,
    createdBy: string,
  ): OrganizationData {
    const resetData: OrganizationData = {
      ...data,
      memberIds: [],
      status: "active",
      billing: {
        status: "incomplete",
        cancelAtPeriodEnd: false,
        entitlements: {},
      },
      usage: {
        templateCount: 0,
        invoiceCount: 0,
        memberCount: 0,
        storageBytes: 0,
      },
    };

    if (resetData.settings?.branding) {
      const { customDomain, ...brandingWithoutDomain } = resetData.settings.branding;
      resetData.settings.branding = brandingWithoutDomain;
    }

    return resetData;
  }

  resolveReferences(
    data: OrganizationData,
    idMapping: IdMappingTable,
  ): OrganizationData {
    return data;
  }

  handleConflict(
    data: OrganizationData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): OrganizationData {
    if (conflictType === "name") {
      return {
        ...data,
        name: this.generateConflictSuffix(data.name, options),
      };
    }
    return data;
  }
}

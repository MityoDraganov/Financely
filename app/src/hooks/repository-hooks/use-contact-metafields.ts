import {
  ContactMetafield,
  ContactMetafieldDefinition,
  CreateContactMetafieldDefinitionInput,
  CreateContactMetafieldInput,
  UpdateContactMetafieldDefinitionInput,
  UpdateContactMetafieldInput,
} from "@/core";
import { contactMetafieldService } from "@/services/contact-metafield-service";
import { createEntityMetafieldHooks } from "./entity-metafield-hooks-factory";

const contactMetafieldHooks = createEntityMetafieldHooks<
  ContactMetafieldDefinition,
  ContactMetafield,
  CreateContactMetafieldDefinitionInput,
  UpdateContactMetafieldDefinitionInput,
  CreateContactMetafieldInput,
  UpdateContactMetafieldInput
>({
  queryKeyPrefix: "contact",
  entityIdField: "contactId",
  service: {
    createMetafieldDefinition: contactMetafieldService.createContactMetafieldDefinition,
    getMetafieldDefinition: contactMetafieldService.getContactMetafieldDefinition,
    listMetafieldDefinitions: contactMetafieldService.listContactMetafieldDefinitions,
    updateMetafieldDefinition: contactMetafieldService.updateContactMetafieldDefinition,
    deleteMetafieldDefinition: contactMetafieldService.deleteContactMetafieldDefinition,
    createMetafield: contactMetafieldService.createContactMetafield,
    getMetafield: contactMetafieldService.getContactMetafield,
    listMetafields: contactMetafieldService.listContactMetafields,
    updateMetafield: contactMetafieldService.updateContactMetafield,
    deleteMetafield: contactMetafieldService.deleteContactMetafield,
  },
});

export const useContactMetafieldDefinitions = contactMetafieldHooks.useMetafieldDefinitions;
export const useContactMetafieldDefinition = contactMetafieldHooks.useMetafieldDefinition;
export const useCreateContactMetafieldDefinition = contactMetafieldHooks.useCreateMetafieldDefinition;
export const useUpdateContactMetafieldDefinition = contactMetafieldHooks.useUpdateMetafieldDefinition;
export const useDeleteContactMetafieldDefinition = contactMetafieldHooks.useDeleteMetafieldDefinition;
export const useContactMetafields = contactMetafieldHooks.useMetafields;
export const useContactMetafield = contactMetafieldHooks.useMetafield;
export const useCreateContactMetafield = contactMetafieldHooks.useCreateMetafield;
export const useUpdateContactMetafield = contactMetafieldHooks.useUpdateMetafield;
export const useDeleteContactMetafield = contactMetafieldHooks.useDeleteMetafield;

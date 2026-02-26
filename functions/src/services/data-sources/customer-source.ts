import { CustomerContext } from "../../core/entities/data-context";
import { ResolverContext } from "../data-source-registry";
import { getContactRepository } from "../../repositories/contact-repository";
import { Contact } from "../../core/entities/contact";

export async function resolveCustomerSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ customer?: CustomerContext }> {
  const customerId = params.customerId;
  if (!customerId) {
    return {};
  }

  const contactRepository = getContactRepository(ctx.databaseService);
  const contact = await contactRepository.get({ id: customerId });

  if (!contact) {
    return {};
  }

  if (contact.data.organizationId !== ctx.organizationId) {
    throw new Error(`Contact ${customerId} does not belong to organization ${ctx.organizationId}`);
  }

  return {
    customer: mapContactToContext(contact),
  };
}

function mapContactToContext(contact: Contact): CustomerContext {
  const phone = contact.data.phone;
  const phoneArray = Array.isArray(phone) ? phone : phone ? [phone] : undefined;

  return {
    id: contact.id,
    firstName: contact.data.firstName,
    lastName: contact.data.lastName,
    email: contact.data.email,
    phone: phoneArray,
    company: contact.data.company,
    jobTitle: contact.data.jobTitle,
    budgetMin: contact.data.budgetMin,
    budgetMax: contact.data.budgetMax,
    budgetCurrency: contact.data.budgetCurrency,
    address: contact.data.address
      ? {
          street: contact.data.address.street,
          city: contact.data.address.city,
          state: contact.data.address.state,
          zipCode: contact.data.address.zipCode,
          country: contact.data.address.country,
        }
      : undefined,
    status: contact.data.status,
  };
}

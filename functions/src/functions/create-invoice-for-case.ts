import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateInvoice } from "../app/handle-create-invoice";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { CreateInvoiceInput } from "../core/entities/invoice";
import { ORGANIZATION_ROLES } from "../core/roles";

type CreateInvoiceForCaseInput = CreateInvoiceInput;

export const createInvoiceForCase = onCall<
  CreateInvoiceForCaseInput,
  Promise<{ id: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.orgId || !payload?.commercialCaseId) {
      throw new HttpsError(
        "invalid-argument",
        "orgId and commercialCaseId are required",
      );
    }

    await verifyAuthAndOrgMembership(request, payload.orgId, {
      requiredRole: ORGANIZATION_ROLES.MEMBER,
    });

    const invoiceId = await handleCreateInvoice(payload);
    return { id: invoiceId };
  },
);

import { onCall } from "firebase-functions/https";

type Payload = {
  invoiceId: string;
  toEmail: string;
};

export const sendInvoiceEmail = onCall<Payload>(
  {
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request) => {
    const { data } = request;
    // TODO: Implement email sending via a provider (e.g., SendGrid, Mailgun)
    // Stub response for now for development
    if (!data.invoiceId || !data.toEmail) {
      throw new Error("Missing invoiceId or toEmail");
    }
    return { sent: true };
  },
);





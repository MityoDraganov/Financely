import { onCall } from "firebase-functions/https";

type Payload = {
  templateVersionId: string;
  invoiceId: string;
};

export const renderInvoicePdf = onCall<Payload>(
  {
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request) => {
    const { data } = request;
    // TODO: Implement server-side rendering via headless Chromium/Playwright
    // For now, return a stub URL
    return { url: `https://example.com/pdf/${data.invoiceId}.pdf` };
  },
);


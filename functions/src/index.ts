import { getApps, initializeApp } from "firebase-admin/app";

/**
 * Initialize Firebase app
 */
if (!getApps().length) {
  initializeApp();
}
export { createInvoice } from "./functions/create-invoice";
export { renderInvoicePdf } from "./functions/render-invoice-pdf";

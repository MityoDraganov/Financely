import type { InvoicePaymentDeliveryMetadata } from "./invoice-payment-delivery";

type SmartPaymentInstructionsConfig = {
  ctaLabel: string;
  fallbackMode: "bank_transfer" | "minimal";
  showReference: boolean;
};

const DEFAULT_CONFIG: SmartPaymentInstructionsConfig = {
  ctaLabel: "Pay now",
  fallbackMode: "bank_transfer",
  showReference: true,
};

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const parseBooleanFlag = (rawValue: string | undefined, fallback: boolean): boolean => {
  if (!rawValue) return fallback;
  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseSmartConfigFromHtml = (nodeHtml: string): SmartPaymentInstructionsConfig => {
  const attrs: Record<string, string> = {};
  for (const match of nodeHtml.matchAll(/data-([a-z0-9-]+)=["']([^"']*)["']/gi)) {
    attrs[match[1].toLowerCase()] = match[2];
  }

  const fallbackModeRaw = (attrs["fallback-mode"] || "").trim().toLowerCase();
  const fallbackMode =
    fallbackModeRaw === "minimal" || fallbackModeRaw === "bank_transfer"
      ? fallbackModeRaw
      : DEFAULT_CONFIG.fallbackMode;

  return {
    ctaLabel: attrs["cta-label"]?.trim() || DEFAULT_CONFIG.ctaLabel,
    fallbackMode,
    showReference: parseBooleanFlag(attrs["show-reference"], DEFAULT_CONFIG.showReference),
  };
};

const renderReferenceRow = (reference: string): string =>
  `<tr><td style="padding:0 0 8px 0;color:#334155;font-size:13px;line-height:1.4;"><strong>Payment reference:</strong> ${escapeHtml(reference)}</td></tr>`;

const renderUrlRow = (url: string, label: string): string => {
  const escapedUrl = escapeHtml(url);
  return `
    <tr>
      <td style="padding:0 0 8px 0;color:#334155;font-size:13px;line-height:1.4;">
        <strong>${escapeHtml(label)}:</strong> 
        <a href="${escapedUrl}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${escapedUrl}</a>
      </td>
    </tr>
  `;
};

const renderMultilineTextRow = (title: string, content: string): string => {
  const normalized = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => escapeHtml(line))
    .join("<br/>");
  if (!normalized) return "";
  return `<tr><td style="padding:0 0 8px 0;color:#334155;font-size:13px;line-height:1.5;"><strong>${escapeHtml(
    title,
  )}:</strong><br/>${normalized}</td></tr>`;
};

const renderSmartPaymentInstructions = (
  config: SmartPaymentInstructionsConfig,
  paymentDelivery: InvoicePaymentDeliveryMetadata,
): string => {
  const statusLabel = {
    payable_online: "Online payment available",
    payable_fallback: "Fallback payment instructions",
    paid: "Invoice is already paid",
    cancelled: "Invoice is cancelled",
  }[paymentDelivery.status];

  const rows: string[] = [
    `<tr><td style="padding:0 0 10px 0;color:#0f172a;font-size:14px;line-height:1.4;font-weight:600;">${statusLabel}</td></tr>`,
  ];

  if (paymentDelivery.status === "payable_online" && paymentDelivery.payUrl) {
    const ctaUrl = escapeHtml(paymentDelivery.payUrl);
    rows.push(`
      <tr>
        <td style="padding:0 0 12px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">
            ${escapeHtml(config.ctaLabel)}
          </a>
        </td>
      </tr>
    `);
    rows.push(renderUrlRow(paymentDelivery.payUrl, "Payment URL"));
  } else if (paymentDelivery.status === "payable_fallback") {
    const fallbackText =
      config.fallbackMode === "bank_transfer"
        ? paymentDelivery.fallbackInstructions
        : paymentDelivery.warningText || "Online payment is unavailable.";
    rows.push(renderMultilineTextRow("How to pay", fallbackText));
    if (paymentDelivery.viewUrl) {
      rows.push(renderUrlRow(paymentDelivery.viewUrl, "Invoice link"));
    } else if (paymentDelivery.pdfUrl) {
      rows.push(renderUrlRow(paymentDelivery.pdfUrl, "Invoice PDF"));
    }
  }

  if (config.showReference && paymentDelivery.reference) {
    rows.push(renderReferenceRow(paymentDelivery.reference));
  }

  if (paymentDelivery.status === "paid") {
    rows.push(
      `<tr><td style="padding:0;color:#16a34a;font-size:13px;line-height:1.4;">No payment action is required.</td></tr>`,
    );
  }
  if (paymentDelivery.status === "cancelled") {
    rows.push(
      `<tr><td style="padding:0;color:#b91c1c;font-size:13px;line-height:1.4;">Payment is not available for cancelled invoices.</td></tr>`,
    );
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin:12px 0 8px 0;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
      <tr>
        <td style="padding:14px 14px 10px 14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${rows.join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
};

export const injectSmartPaymentInstructionsBlocks = ({
  html,
  paymentDelivery,
}: {
  html: string;
  paymentDelivery: InvoicePaymentDeliveryMetadata;
}): string => {
  if (!html || !html.includes("data-smart-payment-instructions")) {
    return html;
  }

  return html.replace(
    /<div\b[^>]*data-smart-payment-instructions=(?:"1"|'1')[^>]*>\s*<\/div>/gi,
    (node) => renderSmartPaymentInstructions(parseSmartConfigFromHtml(node), paymentDelivery),
  );
};


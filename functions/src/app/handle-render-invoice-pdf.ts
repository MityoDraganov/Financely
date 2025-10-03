import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getTemplateRepository } from "../repositories/template-repository";
import { getStorage } from "firebase-admin/storage";
import { Template } from "../core/entities/template";
import { Invoice } from "../core/entities/invoice";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";

/**
 * Generates HTML from template and invoice data
 *
 * @param {Template} template - The template to use for rendering
 * @param {Invoice} invoice - The invoice data to render
 * @return {string} The generated HTML
 */
function generateInvoiceHTML(template: Template, invoice: Invoice): string {
  const { pageSize, brand, elements } = template;

  // Page dimensions
  const pageSizes = {
    A4: { width: 794, height: 1123 },
    Letter: { width: 816, height: 1056 },
  };
  const size = pageSizes[pageSize] || pageSizes.A4;

  /**
   * Helper to get value from invoice data by path
   *
   * @param {unknown} obj - The object to traverse
   * @param {string} path - The dot-notation path
   * @return {unknown} The value at the path, or null if not found
   */
  function getByPath(obj: unknown, path: string): unknown {
    if (!obj || !path) return null;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const key of parts) {
      if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return null;
      }
    }
    return current;
  }

  /**
   * Format value based on format type
   *
   * @param {unknown} value - The value to format
   * @param {object} format - The format configuration
   * @param {string} format.kind - The format kind (none, currency, date)
   * @param {string} [format.currency] - The currency code for currency format
   * @param {string} [format.dateFormat] - The date format string for date format
   * @return {string} The formatted value
   */
  function formatValue(value: unknown, format?: { kind: string; currency?: string; dateFormat?: string }): string {
    if (value == null) return "";
    if (!format || format.kind === "none") return String(value);

    if (format.kind === "currency") {
      const num = Number(value);
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: format.currency || "USD",
      });
      return Number.isFinite(num) ? formatter.format(num) : String(value);
    }

    if (format.kind === "date") {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      if (format.dateFormat === "YYYY-MM-DD") {
        return d.toISOString().slice(0, 10);
      }
      return d.toLocaleDateString();
    }

    return String(value);
  }

  // Render elements as HTML
  const elementsHTML = elements.map((el) => {
    if (!el.visible) return "";

    const commonStyle = `
      position: absolute;
      left: ${el.x}px;
      top: ${el.y}px;
      width: ${el.width}px;
      height: ${el.height}px;
      transform: rotate(${el.rotation}deg);
      z-index: ${el.zIndex || 0};
    `;

    if (el.type === "text") {
      let display = el.text || "";
      if (el.binding) {
        const bound = getByPath(invoice.data, el.binding);
        display = el.format ?
          formatValue(bound, el.format) :
          String(bound ?? "");
      }

      return `
        <div style="${commonStyle}">
          <div style="
            font-family: ${el.typography.fontFamily};
            font-size: ${el.typography.fontSize}px;
            font-weight: ${el.typography.fontWeight};
            line-height: ${el.typography.lineHeight};
            letter-spacing: ${el.typography.letterSpacing}px;
            color: ${el.typography.color};
            text-align: ${el.typography.align};
            ${el.typography.uppercase ? "text-transform: uppercase;" : ""}
            ${el.typography.lowercase ? "text-transform: lowercase;" : ""}
            white-space: pre-wrap;
          ">${display}</div>
        </div>
      `;
    }

    if (el.type === "image") {
      return `
        <div style="${commonStyle}">
          <img src="${el.src}" alt="${el.alt || ""}" style="width: 100%; height: 100%; object-fit: ${el.objectFit};" />
        </div>
      `;
    }

    if (el.type === "box") {
      return `
        <div style="${commonStyle} 
          background: ${el.fill}; 
          border: ${el.strokeWidth}px solid ${el.stroke}; 
          border-radius: ${el.radius}px;
        "></div>
      `;
    }

    if (el.type === "line") {
      return `
        <div style="${commonStyle}">
          <div style="border-top: ${el.strokeWidth}px solid ${el.stroke}; position: absolute; left: 0; right: 0; top: 50%;"></div>
        </div>
      `;
    }

    if (el.type === "table") {
      const items = getByPath(invoice.data, el.itemsBinding) as Array<Record<string, unknown>> || [];

      const columnsHTML = el.columns.map((col) => `
        <div style="padding: 4px; font-weight: 600;">${col.header}</div>
      `).join("");

      const rowsHTML = items.map((row, idx) => {
        const cellsHTML = el.columns.map((col) => {
          const binding = col.binding || col.id;
          const raw = getByPath(row, binding);
          const text = formatValue(raw, col.format);
          const justify = col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start";

          return `
            <div style="padding: 4px; display: flex; align-items: center; justify-content: ${justify};">
              ${text}
            </div>
          `;
        }).join("");

        const borderStyle = el.stripe && idx % 2 === 1 ? "1px solid #f3f4f6" : "1px solid #e5e7eb";

        return `
          <div style="
            display: grid;
            grid-template-columns: ${el.columns.map((c) => `${c.width}px`).join(" ")};
            border-bottom: ${borderStyle};
            height: ${el.rowHeight}px;
          ">
            ${cellsHTML}
          </div>
        `;
      }).join("");

      return `
        <div style="${commonStyle}">
          <div style="width: 100%; height: 100%; font-size: 10px; color: #374151; overflow: hidden;">
            <div style="
              display: grid;
              grid-template-columns: ${el.columns.map((c) => `${c.width}px`).join(" ")};
              border-bottom: 1px solid #e5e7eb;
              height: ${el.headerHeight}px;
            ">
              ${columnsHTML}
            </div>
            <div style="height: calc(100% - ${el.headerHeight}px); overflow: hidden;">
              ${rowsHTML}
            </div>
          </div>
        </div>
      `;
    }

    return "";
  }).join("");

  // Complete HTML document
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { margin: 0; padding: 0; }
          @page { margin: 0; size: ${size.width}px ${size.height}px; }
        </style>
      </head>
      <body>
        <div style="
          position: relative;
          width: ${size.width}px;
          height: ${size.height}px;
          background: white;
          ${brand.backgroundImage ? `background-image: url(${brand.backgroundImage});` : ""}
          background-size: cover;
        ">
          ${elementsHTML}
        </div>
      </body>
    </html>
  `;
}

/**
 * Application handler for rendering an invoice as PDF.
 *
 * This handler:
 * 1. Fetches the invoice and template from database
 * 2. Generates HTML from the template and invoice data
 * 3. Converts HTML to PDF using puppeteer
 * 4. Uploads PDF to Firebase Storage
 * 5. Returns the public URL
 *
 * @param {string} invoiceId - The invoice ID to render
 * @return {Promise<string>} The public URL of the generated PDF
 * @throws Error if invoice/template not found or PDF generation fails
 */
export async function handleRenderInvoicePdf(
  invoiceId: string
): Promise<string> {
  const databaseService = getDatabaseService();
  const invoiceRepository = getInvoiceRepository(databaseService);
  const templateRepository = getTemplateRepository(databaseService);

  // Fetch invoice
  const invoice = await invoiceRepository.get({ id: invoiceId });
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Fetch template
  const template = await templateRepository.get({ id: invoice.templateId });
  if (!template) {
    throw new Error(`Template not found: ${invoice.templateId}`);
  }

  // Generate HTML
  const html = generateInvoiceHTML(template, invoice);

  // Convert HTML to PDF using puppeteer with serverless Chromium
  // Using @sparticuz/chromium for Firebase Cloud Functions compatibility
  let pdfBuffer: Buffer;

  try {
    // Get Chromium executable path for serverless environment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const executablePath = await chromium.executablePath();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      executablePath,
      headless: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const page = await browser.newPage();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await page.setContent(html, { waitUntil: "networkidle0" });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    pdfBuffer = await page.pdf({
      format: template.pageSize === "Letter" ? "letter" : "a4",
      printBackground: true,
    }) as Buffer;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await browser.close();
  } catch (error) {
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}. ` +
      "Make sure dependencies are installed: cd functions && npm install puppeteer @sparticuz/chromium"
    );
  }

  // Upload to Firebase Storage
  const storage = getStorage();
  const bucket = storage.bucket();
  const fileName = `invoices/${invoice.orgId}/${invoiceId}.pdf`;
  const file = bucket.file(fileName);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: {
        invoiceId,
        templateId: invoice.templateId,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Make file publicly accessible
  await file.makePublic();

  // Get public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

  // Update invoice with PDF URL
  await invoiceRepository.update({
    id: invoiceId,
    data: { pdfUrl: publicUrl } as Partial<Invoice>,
  });

  return publicUrl;
}


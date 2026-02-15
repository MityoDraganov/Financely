import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { getStorage } from "firebase-admin/storage";
import { Template, TemplateElement } from "../core/entities/template";
import { Invoice } from "../core/entities/invoice";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import { buildDataContext } from "../services/data-context-builder";
import { resolveBinding } from "../utils/binding-resolver";
import { DataContext } from "../core/entities/data-context";
import { paginateTemplate, type RenderPage } from "../utils/template-pagination";

/**
 * Generates HTML from template and invoice data with organization branding
 *
 * @param {Template} template - The template to use for rendering
 * @param {Invoice} invoice - The invoice data to render
 * @param {Organization | null} organization - Organization for branding
 * @return {string} The generated HTML
 */
function generateInvoiceHTML(
  template: Template,
  invoice: Invoice,
  organization: { settings?: { brandColors?: { primary?: string; secondary?: string; accent?: string }; branding?: { customLogo?: string } } } | null,
  dataContext?: DataContext
): string {
  const { pageSize, brand, elements, pageSettings } = template;

  // Override template brand colors with organization branding if available
  const finalBrand = {
    ...brand,
    colors: {
      primary: organization?.settings?.brandColors?.primary || brand.colors.primary,
      secondary: organization?.settings?.brandColors?.secondary || brand.colors.secondary,
      accent: organization?.settings?.brandColors?.accent || brand.colors.accent,
    },
    // Preserve watermark from template brand
    watermark: brand.watermark,
    // Preserve backgroundImage from template brand (don't auto-add organization logo)
    // The old behavior of automatically adding organization logo as background is removed
    // Users should configure watermarks explicitly through the template designer
    backgroundImage: brand.backgroundImage,
  };

  // Page dimensions in pixels (at 96 DPI to match designer)
  // A4: 210mm x 297mm = 794px x 1123px at 96 DPI
  // Letter: 8.5in x 11in = 816px x 1056px at 96 DPI
  const pageSizes = {
    A4: { width: 794, height: 1123, widthMm: 210, heightMm: 297 },
    Letter: { width: 816, height: 1056, widthMm: 216, heightMm: 279 },
    Legal: { width: 816, height: 1344, widthMm: 216, heightMm: 356 },
  };
  const baseSize = pageSettings?.size === "Custom" && pageSettings.customSize
    ? {
        width: pageSettings.customSize.width,
        height: pageSettings.customSize.height,
        widthMm: (pageSettings.customSize.width / 96) * 25.4,
        heightMm: (pageSettings.customSize.height / 96) * 25.4,
      }
    : pageSizes[(pageSettings?.size as keyof typeof pageSizes) || pageSize] || pageSizes.A4;
  const size = pageSettings?.orientation === "landscape"
    ? {
        width: baseSize.height,
        height: baseSize.width,
        widthMm: baseSize.heightMm,
        heightMm: baseSize.widthMm,
      }
    : baseSize;

  /**
   * Helper to get value from invoice data by path
   *
   * @param {unknown} obj - The object to traverse
   * @param {string} path - The dot-notation path
   * @return {unknown} The value at the path, or null if not found
   */
  function getValueFromContextOrData(
    binding: string,
    dataContext?: DataContext,
    fallbackData?: Record<string, unknown>
  ): unknown {
    if (dataContext) {
      const resolved = resolveBinding(dataContext, binding);
      if (resolved !== null) {
        return resolved;
      }
    }
    if (fallbackData) {
      return getByPath(fallbackData, binding);
    }
    return undefined;
  }

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
   * Format an address object into a readable string
   *
   * @param {unknown} value - The address object
   * @return {string} Formatted address string
   */
  function formatAddress(value: unknown): string {
    if (!value || typeof value !== "object") return "";
    
    const addr = value as Record<string, unknown>;
    const parts: string[] = [];
    
    if (addr.street && typeof addr.street === "string") parts.push(addr.street);
    if (addr.city && typeof addr.city === "string") parts.push(addr.city);
    if (addr.state && typeof addr.state === "string") parts.push(addr.state);
    if (addr.zipCode && typeof addr.zipCode === "string") parts.push(addr.zipCode);
    if (addr.country && typeof addr.country === "string") parts.push(addr.country);
    
    return parts.filter(Boolean).join(", ") || "";
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
    if (value == null || value === undefined) return "";
    
    // Handle objects - check if it's an address-like object
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      // Check if it looks like an address object
      if ("street" in obj || "city" in obj || "country" in obj) {
        return formatAddress(value);
      }
      // For other objects, try to format them nicely
      const entries = Object.entries(obj)
        .filter(([_, v]) => v != null && v !== undefined && v !== "")
        .map(([k, v]) => `${k}: ${String(v)}`);
      return entries.length > 0 ? entries.join(", ") : "";
    }
    
    if (!format || format.kind === "none") {
      // Handle arrays
      if (Array.isArray(value)) {
        return value.map(v => String(v)).join(", ");
      }
      return String(value);
    }

    if (format.kind === "currency") {
      const num = Number(value);
      if (!Number.isFinite(num)) return String(value);
      
      const currencyCode = format.currency || "USD";
      
      // Try to format with proper decimal places
      try {
        const formatter = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currencyCode,
          minimumFractionDigits: currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2,
          maximumFractionDigits: currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2,
        });
        return formatter.format(num);
      } catch {
        // Fallback if currency code is invalid
        return `${currencyCode} ${num.toFixed(2)}`;
      }
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

  // Get margins from template
  const margins = template.pageSettings?.margins ?? template.brand?.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const usableHeight = size.height - margins.top - margins.bottom;
  
  // Paginate template into multiple pages
  const pages = paginateTemplate(template, invoice.data, { w: size.width, h: size.height });
  
  // Helper to calculate element position on a page (accounting for page offset and margins)
  const calculateElementPosition = (
    el: TemplateElement,
    pageIndex: number,
    adjustedY: number
  ): { x: number; y: number } => {
    const pageStartY = pageIndex * usableHeight;
    const yInUsableArea = adjustedY - pageStartY;
    const yOnPage = margins.top + yInUsableArea;
    
    return {
      x: el.x,
      y: yOnPage,
    };
  };

  // Helper to calculate adjusted Y position accounting for table expansion
  const calculateAdjustedY = (el: TemplateElement): number => {
    let adjustedY = el.y;

    for (const prevEl of elements) {
      if (prevEl.id === el.id) break;
      if (prevEl.type === "pageBreak") {
        adjustedY += usableHeight;
      }
    }
    
    // Adjust for tables that came before and expanded
    for (const prevEl of elements) {
      if (prevEl.id === el.id) break;
      
      if (prevEl.type === "table" && prevEl.y < el.y) {
        const prevTbl = prevEl;
        const allItems = (getValueFromContextOrData(prevTbl.itemsBinding, dataContext, invoice.data) as Array<Record<string, unknown>>) || [];
        const prevOriginalHeight = prevTbl.headerHeight + prevTbl.rowHeight;
        const prevActualHeight = prevTbl.headerHeight + (allItems.length * prevTbl.rowHeight) + (prevTbl.columns.some((c) => c.showTotal) ? prevTbl.rowHeight : 0);
        const prevTableBottom = prevEl.y + prevOriginalHeight;
        
        if (el.y >= prevTableBottom) {
          adjustedY += (prevActualHeight - prevOriginalHeight);
        }
      }
    }
    
    return adjustedY;
  };

  // Render a single page's elements
  const renderPageElements = (page: RenderPage): string => {
    return page.elements.map((el) => {
      if (!el.visible) return "";

      // Calculate adjusted Y position
      let adjustedY = calculateAdjustedY(el);
      
      const pos = calculateElementPosition(el, page.pageIndex, adjustedY);
      
      const commonStyle = `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        width: ${el.width}px;
        height: ${el.height}px;
        transform: rotate(${el.rotation}deg);
        z-index: ${el.zIndex || 0};
      `;

    if (el.type === "text") {
      let display = el.text || "";
      if (el.binding) {
        let bound: unknown = undefined;
        bound = getValueFromContextOrData(el.binding, dataContext, invoice.data);
        if (bound != null && bound !== undefined) {
          display = el.format ?
            formatValue(bound, el.format) :
            formatValue(bound);
        } else {
          display = "";
        }
      }

      return `
        <div style="${commonStyle}">
          <div style="
            font-family: ${el.typography.fontFamily};
            font-size: ${el.typography.fontSize}px;
            font-weight: ${el.typography.fontWeight};
            font-style: ${el.typography.fontStyle || "normal"};
            line-height: ${el.typography.lineHeight};
            letter-spacing: ${el.typography.letterSpacing}px;
            ${el.typography.wordSpacing != null ? `word-spacing: ${el.typography.wordSpacing}px;` : ""}
            color: ${el.typography.color};
            text-align: ${el.typography.align};
            ${el.typography.textDecoration ? `text-decoration: ${el.typography.textDecoration};` : ""}
            ${el.typography.textIndent != null ? `text-indent: ${el.typography.textIndent}px;` : ""}
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
          <img src="${el.src}" alt="${el.alt || ""}" style="
            width: 100%;
            height: 100%;
            object-fit: ${el.objectFit};
            ${el.objectPosition ? `object-position: ${el.objectPosition};` : ""}
            opacity: ${el.opacity ?? 1};
            ${el.border ? `border: ${el.border.width}px ${el.border.style} ${el.border.color}; border-radius: ${el.border.radius}px;` : ""}
          " />
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
          <div style="border-top: ${el.strokeWidth}px ${el.style || "solid"} ${el.stroke}; opacity: ${el.opacity ?? 1}; position: absolute; left: 0; right: 0; top: 50%;"></div>
        </div>
      `;
    }

    if (el.type === "input") {
      const inp = el as Extract<TemplateElement, { type: "input" }>;
      const boundValue = inp.binding ? getValueFromContextOrData(inp.binding, dataContext, invoice.data) : undefined;
      const displayValue = boundValue != null ? String(boundValue) : "";
      
      return `
        <div style="${commonStyle}">
          <div style="
            width: 100%;
            height: 100%;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            color: ${displayValue ? "#111827" : "#9ca3af"};
            background-color: #ffffff;
            display: flex;
            align-items: center;
            text-align: ${inp.align || "left"};
            overflow: hidden;
            box-sizing: border-box;
          ">${displayValue || inp.placeholder || ""}</div>
        </div>
      `;
    }

	    if (el.type === "currency") {
	      const curr = el as Extract<TemplateElement, { type: "currency" }>;
      const boundValue = curr.binding ? getValueFromContextOrData(curr.binding, dataContext, invoice.data) : undefined;
      
      // Format as currency
      let displayValue = "";
      if (boundValue != null) {
        const num = Number(boundValue);
        if (Number.isFinite(num)) {
          const currency = curr.currency || "USD";
          try {
            const formatter = new Intl.NumberFormat(undefined, {
              style: "currency",
              currency,
            });
            displayValue = formatter.format(num);
          } catch {
            displayValue = `${currency} ${num.toFixed(2)}`;
          }
        } else {
          displayValue = String(boundValue);
        }
      }
      
      return `
        <div style="${commonStyle}">
          <div style="
            width: 100%;
            height: 100%;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            color: ${displayValue ? "#111827" : "#9ca3af"};
            background-color: #ffffff;
            display: flex;
            align-items: center;
            gap: 4px;
            text-align: ${curr.align || "left"};
            overflow: hidden;
            box-sizing: border-box;
          ">
            <span style="font-size: 10px; color: #6b7280; font-weight: 500;">${curr.currency || "USD"}</span>
            <span style="flex: 1;">${displayValue || curr.placeholder || "0.00"}</span>
          </div>
        </div>
	      `;
	    }

      if (el.type === "icon") {
        const iconEl = el as Extract<TemplateElement, { type: "icon" }>;
        return `
          <div style="${commonStyle}; display: flex; align-items: center; justify-content: center; color: ${iconEl.color};">
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase;">${iconEl.iconName}</div>
          </div>
        `;
      }

      if (el.type === "spacer") {
        const spacer = el as Extract<TemplateElement, { type: "spacer" }>;
        if (!spacer.showDivider) return `<div style="${commonStyle}"></div>`;
        return `
          <div style="${commonStyle}">
            <div style="border-top: ${spacer.dividerWidth}px ${spacer.dividerStyle} ${spacer.dividerColor}; width: 100%; position: absolute; top: 50%; left: 0;"></div>
          </div>
        `;
      }

      if (el.type === "pageBreak") {
        return "";
      }

      if (el.type === "qrCode") {
        const qr = el as Extract<TemplateElement, { type: "qrCode" }>;
        const value = qr.binding ? getValueFromContextOrData(qr.binding, dataContext, invoice.data) : qr.content;
        return `
          <div style="${commonStyle}; background: ${qr.backgroundColor}; color: ${qr.foregroundColor}; border: 1px solid #d1d5db; display: grid; place-items: center; font-size: 10px; font-weight: 700;" title="${String(value ?? "")}">
            QR
          </div>
        `;
      }

      if (el.type === "barcode") {
        const barcode = el as Extract<TemplateElement, { type: "barcode" }>;
        const value = barcode.binding ? getValueFromContextOrData(barcode.binding, dataContext, invoice.data) : barcode.value;
        return `
          <div style="${commonStyle}; background: ${barcode.backgroundColor}; color: ${barcode.color}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div style="width: 92%; height: 60%; background-image: repeating-linear-gradient(to right, currentColor 0, currentColor 2px, transparent 2px, transparent 4px);"></div>
            ${barcode.showText ? `<div style="font-size: 10px; letter-spacing: 1px;">${String(value ?? "BARCODE")}</div>` : ""}
          </div>
        `;
      }

      if (el.type === "signature") {
        const signature = el as Extract<TemplateElement, { type: "signature" }>;
        return `
          <div style="${commonStyle}">
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end;">
              ${
                signature.signatureType === "image" && signature.signatureImage
                  ? `<img src="${signature.signatureImage}" alt="Signature" style="max-height: 70%; object-fit: contain; object-position: left bottom;" />`
                  : `<div style="font-size: 10px; color: #6b7280; margin-bottom: 4px;">${signature.placeholderText || "Signature"}</div>`
              }
              <div style="border-bottom: ${signature.borderBottom?.width ?? 1}px ${signature.borderBottom?.style ?? "solid"} ${signature.borderBottom?.color ?? "#111827"};"></div>
            </div>
          </div>
        `;
      }

      if (el.type === "stamp") {
        const stamp = el as Extract<TemplateElement, { type: "stamp" }>;
        return `
          <div style="${commonStyle}; background: ${stamp.backgroundColor}; color: ${stamp.textColor}; opacity: ${stamp.opacity}; border-radius: ${stamp.shape === "circle" ? "9999px" : "8px"}; border: ${stamp.border ? `${stamp.border.width}px ${stamp.border.style} ${stamp.border.color}` : "1px solid currentColor"}; font-family: ${stamp.fontFamily}; font-size: ${stamp.fontSize}px; font-weight: ${stamp.fontWeight}; display: flex; align-items: center; justify-content: center; text-transform: uppercase;">
            ${stamp.text}
          </div>
        `;
      }

      if (el.type === "table") {
        const allItems = (getValueFromContextOrData(el.itemsBinding, dataContext, invoice.data) as Array<Record<string, unknown>>) || [];
        
        // Get table slice for this page
        const slice = page.tableSlices[el.id];
        const items = slice ? allItems.slice(slice.start, slice.end) : allItems;
        const showTotals = slice ? slice.isLastSlice : true;

        const columnsHTML = el.columns.map((col) => `
          <div style="padding: 4px; font-weight: 600;">${col.header}</div>
        `).join("");

        const rowsHTML = items.map((row, idx) => {
          const actualIdx = slice ? slice.start + idx : idx;
        const cellsHTML = el.columns.map((col) => {
          const binding = col.binding || col.id;
          const raw = getByPath(row, binding);
          
          // Handle currency type columns
          let text: string;
          if (col.type === "currency") {
            if (raw != null && raw !== undefined) {
              const num = Number(raw);
              if (Number.isFinite(num)) {
                const currency = col.currency || col.format?.currency || "USD";
                try {
                  const formatter = new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency,
                  });
                  text = formatter.format(num);
                } catch {
                  text = `${currency} ${num.toFixed(2)}`;
                }
              } else {
                text = String(raw);
              }
            } else {
              text = "";
            }
          } else {
          // Use formatValue to handle objects, arrays, and null/undefined properly
            text = raw != null && raw !== undefined 
            ? formatValue(raw, col.format)
            : "";
          }
          
          const justify = col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start";

          return `
            <div style="padding: 4px; display: flex; align-items: center; justify-content: ${justify}; word-break: break-word; overflow-wrap: break-word; min-height: 20px;">
              ${text}
            </div>
          `;
        }).join("");

          const borderStyle = el.stripe && actualIdx % 2 === 1 ? "1px solid #f3f4f6" : "1px solid #e5e7eb";

        return `
          <div style="
            display: grid;
            grid-template-columns: ${el.columns.map((c) => `${c.width}px`).join(" ")};
            border-bottom: ${borderStyle};
            min-height: ${el.rowHeight}px;
            padding: 4px 0;
          ">
            ${cellsHTML}
          </div>
        `;
      }).join("");

        // Totaling Row HTML - per column (only show on last slice)
        let totalsHTML = "";
        if (showTotals && el.columns.some((c) => c.showTotal)) {
          const totalsCellsHTML = el.columns.map((col) => {
            let text = "";
            let cellStyle: Record<string, string> = {
              padding: "4px",
              display: "flex",
              "align-items": "center",
              "justify-content": col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
            };
            
            if (col.showTotal && (col.type === "number" || col.type === "currency")) {
              try {
                // Sum all values in the column (from all items, not just this slice)
                const columnBinding = col.binding || col.id;
                const columnValues = allItems
                .map((row) => {
                  const val = getByPath(row, columnBinding);
                  if (val != null) {
                    const num = Number(val);
                    return Number.isFinite(num) ? num : 0;
                  }
                  return 0;
                })
                .filter((v) => typeof v === "number");
              
              const sum = columnValues.reduce((s, v) => s + v, 0);
              
              // Format the result
              if (col.type === "currency") {
                const currency = col.currency || col.format?.currency || "USD";
                try {
                  const formatter = new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency,
                  });
                  text = formatter.format(sum);
                } catch {
                  text = `${currency} ${sum.toFixed(2)}`;
                }
              } else {
                text = formatValue(sum, col.format);
              }
              
              // Apply total cell styling
              if (col.totalStyle) {
                if (col.totalStyle.backgroundColor) {
                  cellStyle["background-color"] = col.totalStyle.backgroundColor;
                }
                if (col.totalStyle.color) {
                  cellStyle.color = col.totalStyle.color;
                }
                if (col.totalStyle.fontWeight) {
                  cellStyle["font-weight"] = col.totalStyle.fontWeight;
                }
                if (col.totalStyle.fontSize) {
                  cellStyle["font-size"] = `${col.totalStyle.fontSize}px`;
                }
                if (col.totalStyle.borderTop) {
                  cellStyle["border-top"] = col.totalStyle.borderTop;
                }
              } else {
                // Default styling
                cellStyle["background-color"] = "#f9fafb";
                cellStyle["font-weight"] = "bold";
                cellStyle["border-top"] = "2px solid #111827";
              }
            } catch (error) {
              console.error("Error calculating column total:", error);
              text = "";
            }
          }

          const styleString = Object.entries(cellStyle)
            .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value}`)
            .join("; ");

          return `
            <div style="${styleString}">
              ${text}
            </div>
          `;
        }).join("");
        
        totalsHTML = `
          <div style="
            display: grid;
            grid-template-columns: ${el.columns.map((c) => `${c.width}px`).join(" ")};
            border-bottom: 1px solid #e5e7eb;
            height: ${el.rowHeight}px;
          ">
            ${totalsCellsHTML}
          </div>
        `;
      }

      // Calculate actual table height for this slice
        const headerHeight = el.headerHeight || 28;
        const rowHeight = el.rowHeight || 28;
        const actualContentHeight = items.length * rowHeight;
        const totalsHeight = totalsHTML ? rowHeight : 0;
        const totalTableHeight = headerHeight + actualContentHeight + totalsHeight;
        
        return `
          <div style="${commonStyle}; height: ${totalTableHeight}px;">
            <div style="width: 100%; height: 100%; font-size: 10px; color: #374151; overflow: visible;">
              <div style="
                display: grid;
                grid-template-columns: ${el.columns.map((c) => `${c.width}px`).join(" ")};
                border-bottom: 1px solid #e5e7eb;
                height: ${el.headerHeight}px;
              ">
                ${columnsHTML}
              </div>
              <div style="overflow: visible;">
                ${rowsHTML}
                ${totalsHTML}
              </div>
            </div>
          </div>
        `;
      }

      return "";
    }).join("");
  };

  // Generate watermark HTML if enabled AND has valid imageUrl or text
  // This prevents rendering empty watermarks or old/incomplete configurations
  let watermarkHTML = "";
  const watermark = finalBrand.watermark;
  if (watermark?.enabled && (watermark.imageUrl || watermark.text)) {
    // Only use the explicitly configured watermark image URL or text
    // Don't fallback to organization logo - that would be a separate feature
    const watermarkImageUrl = watermark.imageUrl;
    
    // Calculate position
    let positionStyle = "";
    if (watermark.x !== undefined && watermark.y !== undefined) {
      // Custom position
      positionStyle = `left: ${watermark.x}px; top: ${watermark.y}px; transform: translate(0, 0) rotate(${watermark.rotation}deg);`;
    } else {
      // Preset position
      const positions: Record<string, string> = {
        "center": `left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(${watermark.rotation}deg);`,
        "top-left": `left: 0; top: 0; transform: rotate(${watermark.rotation}deg);`,
        "top-right": `right: 0; top: 0; transform: rotate(${watermark.rotation}deg);`,
        "bottom-left": `left: 0; bottom: 0; transform: rotate(${watermark.rotation}deg);`,
        "bottom-right": `right: 0; bottom: 0; transform: rotate(${watermark.rotation}deg);`,
        "top-center": `left: 50%; top: 0; transform: translateX(-50%) rotate(${watermark.rotation}deg);`,
        "bottom-center": `left: 50%; bottom: 0; transform: translateX(-50%) rotate(${watermark.rotation}deg);`,
        "left-center": `left: 0; top: 50%; transform: translateY(-50%) rotate(${watermark.rotation}deg);`,
        "right-center": `right: 0; top: 50%; transform: translateY(-50%) rotate(${watermark.rotation}deg);`,
      };
      positionStyle = positions[watermark.position] || positions.center;
    }

    const width = watermark.width || 200;
    const height = watermark.height ? `${watermark.height}px` : "auto";
    const opacity = watermark.opacity ?? 0.1;
    const repeat = watermark.repeat || "none";

    if (watermarkImageUrl) {
      // Image watermark
      if (repeat === "none") {
        watermarkHTML = `
          <div style="
            position: absolute;
            ${positionStyle}
            width: ${width}px;
            height: ${height};
            opacity: ${opacity};
            pointer-events: none;
            z-index: 1000;
          ">
            <img src="${watermarkImageUrl}" alt="Watermark" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
        `;
      } else {
        // Tiled watermark
        const backgroundSize = repeat === "repeat" ? `${width}px ${watermark.height || width}px` :
                              repeat === "repeat-x" ? `${width}px auto` :
                              `${width}px auto`;
        watermarkHTML = `
          <div style="
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-image: url(${watermarkImageUrl});
            background-repeat: ${repeat};
            background-size: ${backgroundSize};
            opacity: ${opacity};
            pointer-events: none;
            z-index: 1000;
            transform: rotate(${watermark.rotation}deg);
          "></div>
        `;
      }
    } else if (watermark.text) {
      // Text watermark
      if (repeat === "none") {
        watermarkHTML = `
          <div style="
            position: absolute;
            ${positionStyle}
            width: ${width}px;
            opacity: ${opacity};
            pointer-events: none;
            z-index: 1000;
            font-size: ${Math.max(24, width / 10)}px;
            font-weight: bold;
            color: #999999;
            text-align: center;
            white-space: nowrap;
          ">${watermark.text}</div>
        `;
      } else {
        // Tiled text watermark (using background pattern would be complex, so we'll use a single centered one)
        watermarkHTML = `
          <div style="
            position: absolute;
            ${positionStyle}
            width: ${width}px;
            opacity: ${opacity};
            pointer-events: none;
            z-index: 1000;
            font-size: ${Math.max(24, width / 10)}px;
            font-weight: bold;
            color: #999999;
            text-align: center;
            white-space: nowrap;
          ">${watermark.text}</div>
        `;
      }
    }
  }

  // Render all pages
  const pagesHTML = pages.map((page, pageIndex) => {
    const pageBreak = pageIndex > 0 ? "page-break-before: always;" : "";
    return `
      <div class="page" style="
        position: relative;
        width: ${size.width}px;
        height: ${size.height}px;
        background: ${pageSettings?.backgroundColor || "white"};
        ${pageSettings?.backgroundImage ? `background-image: url(${pageSettings.backgroundImage});` : finalBrand.backgroundImage ? `background-image: url(${finalBrand.backgroundImage});` : ""}
        background-size: cover;
        ${pageBreak}
      ">
        ${watermarkHTML}
        ${renderPageElements(page)}
      </div>
    `;
  }).join("");

  // Complete HTML document with multiple pages
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { 
            margin: 0; 
            padding: 0; 
            width: ${size.width}px;
            overflow: hidden;
          }
          @page { 
            margin: 0; 
            size: ${size.widthMm}mm ${size.heightMm}mm; 
          }
          .page {
            page-break-after: always;
          }
          .page:last-child {
            page-break-after: auto;
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
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
  const organizationRepository = getOrganizationRepository(databaseService);

  // Fetch invoice
  const invoice = await invoiceRepository.get({ id: invoiceId });
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  // Fetch template from Realtime Database (templates are stored in RTDB, not Firestore)
  const template = await realtimeDatabaseService.get<Template>("templates", invoice.templateId);
  if (!template) {
    throw new Error(`Template not found: ${invoice.templateId}`);
  }

  // Fetch organization for branding
  let organization = null;
  if (invoice.orgId) {
    organization = await organizationRepository.get({ id: invoice.orgId });
  }

  // Build DataContext for template rendering
  const dataContext = await buildDataContext(
    {
      include: ["invoice", "organization"],
      invoiceId: invoice.id,
      organizationId: invoice.orgId,
    },
    databaseService
  );

  // Generate HTML with organization branding
  const html = generateInvoiceHTML(template, invoice, organization, dataContext);

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

    // Use exact pixel dimensions to match designer (96 DPI)
    // Page dimensions in pixels (at 96 DPI to match designer)
    const pageSizes = {
      A4: { width: 794, height: 1123 },
      Letter: { width: 816, height: 1056 },
      Legal: { width: 816, height: 1344 },
    };
    const basePdfSize = template.pageSettings?.size === "Custom" && template.pageSettings.customSize
      ? {
          width: template.pageSettings.customSize.width,
          height: template.pageSettings.customSize.height,
        }
      : pageSizes[(template.pageSettings?.size as keyof typeof pageSizes) || template.pageSize] || pageSizes.A4;
    const pdfSize = template.pageSettings?.orientation === "landscape"
      ? { width: basePdfSize.height, height: basePdfSize.width }
      : basePdfSize;
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const page = await browser.newPage();
    
    // Set viewport to match page size exactly (1:1 pixel mapping)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await page.setViewport({
      width: pdfSize.width,
      height: pdfSize.height,
      deviceScaleFactor: 1,
    });
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await page.setContent(html, { waitUntil: "networkidle0" });
    
    // Convert pixels to inches for Puppeteer (1 inch = 96 pixels)
    const widthInches = pdfSize.width / 96;
    const heightInches = pdfSize.height / 96;
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    pdfBuffer = await page.pdf({
      width: `${widthInches}in`,
      height: `${heightInches}in`,
      printBackground: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      preferCSSPageSize: false, // Use explicit width/height instead of @page CSS
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

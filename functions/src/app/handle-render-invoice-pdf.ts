import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { TemplateData, TemplateElement } from "../core/entities/template";
import { Invoice } from "../core/entities/invoice";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import { buildDataContext } from "../services/data-context-builder";
import { resolveBinding } from "../utils/binding-resolver";
import { DataContext } from "../core/entities/data-context";
import {
  paginateTemplate,
  type ElementSlice,
  type RenderPage,
} from "../utils/template-pagination";
import { resolveTemplateMarginsPx } from "../utils/print-margins";
import { computeTableRuntimeLayout } from "../utils/template-table-layout";
import { getTableGridTemplateColumns } from "../utils/table-column-width";
import { getTableTextBehaviorInlineCss, normalizeTableTextBehavior } from "../utils/table-text-behavior";
import {
  loadLatestTemplateSnapshotVersion,
  loadLiveTemplateSnapshot,
  loadTemplateSnapshotFromVersionId,
} from "../services/invoice-template-snapshot-service";

/**
 * Generates HTML from template and invoice data with organization branding
 *
 * @param {TemplateData} template - The template snapshot to use for rendering
 * @param {Invoice} invoice - The invoice data to render
 * @param {Organization | null} organization - Organization for branding
 * @return {string} The generated HTML
 */
export function generateInvoiceHTML(
  template: TemplateData,
  invoice: Invoice,
  organization: {
    logoUrl?: string;
    settings?: {
      brandColors?: { primary?: string; secondary?: string; accent?: string };
      branding?: { customLogo?: string };
    };
  } | null,
  dataContext?: DataContext
): string {
  const { pageSize, brand, elements, pageSettings } = template;

  function encodeGoogleFamily(family: string): string {
    return encodeURIComponent(family.trim()).replace(/%20/g, "+");
  }

  function buildGoogleFontLinks(): string {
    const families = new Set<string>();
    brand?.fonts?.forEach((font) => {
      if (typeof font === "string" && font.trim().length > 0) families.add(font.trim());
    });

    (elements || []).forEach((element) => {
      if (element.type === "text" && element.typography?.fontFamily) {
        families.add(element.typography.fontFamily);
      }
      if (element.type === "input" && element.fontFamily) {
        families.add(element.fontFamily);
      }
      if (element.type === "currency" && element.fontFamily) {
        families.add(element.fontFamily);
      }
      if (element.type === "table") {
        if (element.headerStyle?.fontFamily) families.add(element.headerStyle.fontFamily);
        if (element.rowStyle?.fontFamily) families.add(element.rowStyle.fontFamily);
        if (element.footerStyle?.fontFamily) families.add(element.footerStyle.fontFamily);
      }
      if (element.type === "stamp" && element.fontFamily) {
        families.add(element.fontFamily);
      }
    });

    const familyList = Array.from(families);
    if (familyList.length === 0) return "";

    const chunkSize = 20;
    const links: string[] = [];
    for (let i = 0; i < familyList.length; i += chunkSize) {
      const chunk = familyList.slice(i, i + chunkSize);
      const params = chunk
        .map((family) => `family=${encodeGoogleFamily(family)}:wght@400;500;600;700`)
        .join("&");
      links.push(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${params}&display=swap">`);
    }
    return links.join("\n");
  }

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

  const organizationLogoUrl =
    organization?.settings?.branding?.customLogo?.trim() ||
    organization?.logoUrl?.trim() ||
    "";

  const imageSourceAliases = new Set([
    "logo",
    "brand_logo",
    "brand-logo",
    "company_logo",
    "company-logo",
    "org_logo",
    "org-logo",
    "organization_logo",
    "organization-logo",
  ]);

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

  function asNonEmptyString(value: unknown): string {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed;
  }

  function normalizeQrColor(color: string | undefined, fallback: string): string {
    if (!color) return fallback;
    const trimmed = color.trim().replace(/^#/, "");
    if (!trimmed) return fallback;
    return trimmed;
  }

  function buildQrCodeImageUrl(
    value: string,
    options?: {
      size?: number;
      foregroundColor?: string;
      backgroundColor?: string;
      errorCorrection?: "low" | "medium" | "high" | "ultra";
    },
  ): string {
    const size = options?.size ?? 256;
    const ecc =
      options?.errorCorrection === "low"
        ? "L"
        : options?.errorCorrection === "high"
          ? "Q"
          : options?.errorCorrection === "ultra"
            ? "H"
            : "M";
    const qzone = "0";
    const fgColor = normalizeQrColor(options?.foregroundColor, "111827");
    const bgColor = normalizeQrColor(options?.backgroundColor, "ffffff");

    const url = new URL("https://api.qrserver.com/v1/create-qr-code/");
    url.searchParams.set("size", `${size}x${size}`);
    url.searchParams.set("ecc", ecc);
    url.searchParams.set("format", "png");
    url.searchParams.set("qzone", qzone);
    url.searchParams.set("color", fgColor);
    url.searchParams.set("bgcolor", bgColor);
    url.searchParams.set("data", value);
    return url.toString();
  }

  function resolveLogoFromContext(): string {
    const candidates: unknown[] = [
      organizationLogoUrl,
      getValueFromContextOrData("organization.settings.branding.customLogo", dataContext, invoice.data),
      getValueFromContextOrData("organization.logoUrl", dataContext, invoice.data),
      getValueFromContextOrData("branding.customLogo", dataContext, invoice.data),
      getValueFromContextOrData("logoUrl", dataContext, invoice.data),
      getValueFromContextOrData("logo", dataContext, invoice.data),
    ];

    for (const candidate of candidates) {
      const normalized = asNonEmptyString(candidate);
      if (normalized) return normalized;
    }
    return "";
  }

  function resolveImageSource(rawSrc: unknown): string {
    const src = asNonEmptyString(rawSrc);
    if (!src) return "";
    if (!imageSourceAliases.has(src.toLowerCase())) return src;
    return resolveLogoFromContext();
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

  const margins = resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins);
  const usableHeight = size.height - margins.top - margins.bottom;
  const getTableBaselineHeight = (table: Extract<TemplateElement, { type: "table" }>): number => {
    const minimumContentHeight = table.headerHeight + table.rowHeight;
    const configuredHeight =
      typeof table.height === "number" && Number.isFinite(table.height)
        ? table.height
        : minimumContentHeight;
    return Math.max(minimumContentHeight, configuredHeight);
  };
  
  // Paginate template into multiple pages
  const pages = paginateTemplate(template, invoice.data, { w: size.width, h: size.height });
  
  // Helper to calculate element position on a page (accounting for page offset and margins)
  const calculateElementPosition = (
    el: TemplateElement,
    pageIndex: number,
    adjustedY: number,
    elementSlice?: ElementSlice
  ): { x: number; y: number; width: number; height: number } => {
    const pageStartY = margins.top + pageIndex * usableHeight;
    const effectiveY = adjustedY + (elementSlice?.offsetY ?? 0);
    const effectiveHeight = elementSlice?.height ?? el.height;
    const yInUsableArea = effectiveY - pageStartY;
    const yOnPage = margins.top + yInUsableArea;

    const clampedX = Math.max(margins.left, Math.min(el.x, size.width - margins.right));
    const clampedY = Math.max(margins.top, Math.min(yOnPage, size.height - margins.bottom));
    const maxWidth = Math.max(0, size.width - margins.right - clampedX);
    const maxHeight = Math.max(0, size.height - margins.bottom - clampedY);
    const clampedWidth = Math.max(0, Math.min(el.width, maxWidth));
    const clampedHeight = Math.max(0, Math.min(effectiveHeight, maxHeight));

    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
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
        const prevOriginalHeight = getTableBaselineHeight(prevTbl);
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
  // Render background elements (box, image, path, line, text) at their stored coordinates.
  // Background elements repeat identically on every page — they are never paginated.
  const renderBackgroundElements = (page: RenderPage): string => {
    return (page.backgroundElements ?? []).map((el) => {
      if (!el.visible || el.type === "group") return "";
      const adjustedY = el.y; // No pagination — use stored Y directly
      const pos = calculateElementPosition(el, page.pageIndex, adjustedY);
      const commonStyle = `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        width: ${pos.width}px;
        height: ${pos.height}px;
        transform: rotate(${el.rotation}deg);
        z-index: 0;
        pointer-events: none;
      `;
      if (el.type === "box") {
        const fill = el.fillGradient
          ? `background: linear-gradient(${el.fillGradient.angle}deg, ${el.fillGradient.colors.join(", ")})`
          : `background: ${el.fill || "transparent"}`;
        const strokeStyle = el.strokeWidth
          ? `border: ${el.strokeWidth}px ${el.strokeStyle || "solid"} ${el.stroke || "transparent"}`
          : "";
        return `<div style="${commonStyle} ${fill}; ${strokeStyle}; border-radius: ${el.radius || 0}px; opacity: ${el.opacity ?? 1};"></div>`;
      }
      if (el.type === "image") {
        const src = el.src || "";
        return src
          ? `<img src="${src}" style="${commonStyle} object-fit: ${el.objectFit || "contain"}; opacity: ${el.opacity ?? 1};" />`
          : "";
      }
      if (el.type === "path") {
        const pathD = el.pathData || "";
        if (!pathD) return "";
        const fill = el.fill || "transparent";
        return `<svg style="${commonStyle}" viewBox="0 0 ${el.width} ${el.height}" xmlns="http://www.w3.org/2000/svg"><path d="${pathD}" fill="${fill}" opacity="${el.opacity ?? 1}" /></svg>`;
      }
      if (el.type === "line") {
        return `<div style="${commonStyle}"><svg width="${el.width}" height="${el.height}" xmlns="http://www.w3.org/2000/svg"><line x1="${el.x}" y1="${el.y}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke || "#000"}" stroke-width="${el.strokeWidth || 1}" /></svg></div>`;
      }
      if (el.type === "text") {
        const text = el.text || "";
        const typo = el.typography;
        const textStyle = typo ? `font-family: ${typo.fontFamily || "Inter"}; font-size: ${typo.fontSize || 12}px; font-weight: ${typo.fontWeight || "normal"}; color: ${typo.color || "#111827"}; text-align: ${typo.align || "left"};` : "";
        return `<div style="${commonStyle} ${textStyle} overflow: hidden;">${text}</div>`;
      }
      return "";
    }).join("");
  };

  const renderPageElements = (page: RenderPage): string => {
    const bgHtml = renderBackgroundElements(page);
    const contentHtml = page.elements.map((el) => {
      if (!el.visible) return "";

      const elementSlice = page.elementSlices[el.id];
      const adjustedY = page.elementPositions[el.id] ?? calculateAdjustedY(el);
      const pos = calculateElementPosition(el, page.pageIndex, adjustedY, elementSlice);
      const commonStyle = `
        position: absolute;
        left: ${pos.x}px;
        top: ${pos.y}px;
        width: ${pos.width}px;
        height: ${pos.height}px;
        transform: rotate(${el.rotation}deg);
        z-index: ${el.zIndex || 0};
        ${elementSlice ? "overflow: hidden;" : ""}
        box-sizing: border-box;
      `;

      if (el.type === "group") {
        const g = el as Extract<TemplateElement, { type: "group" }>;
        const fill = g.backgroundColor?.trim();
        if (!fill) return "";
        return `<div style="${commonStyle} background-color: ${fill};"></div>`;
      }

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
      const boundImageValue = el.binding
        ? getValueFromContextOrData(el.binding, dataContext, invoice.data)
        : undefined;
      const imageSrc = resolveImageSource(
        asNonEmptyString(boundImageValue) || el.src
      );
      return `
        <div style="${commonStyle}">
          ${
            imageSrc
              ? `<img src="${imageSrc}" alt="${el.alt || ""}" style="
            width: 100%;
            height: 100%;
            object-fit: ${el.objectFit};
            ${el.objectPosition ? `object-position: ${el.objectPosition};` : ""}
            opacity: ${el.opacity ?? 1};
            ${el.border ? `border: ${el.border.width}px ${el.border.style} ${el.border.color}; border-radius: ${el.border.radius}px;` : ""}
          " />`
              : `<div style="
            width: 100%;
            height: 100%;
            background: #f3f4f6;
          "></div>`
          }
        </div>
      `;
    }

    if (el.type === "box") {
      const box = el as Extract<TemplateElement, { type: "box" }>;
      const fillCss = box.fillGradient
        ? box.fillGradient.type === "linear"
          ? `linear-gradient(${box.fillGradient.angle}deg, ${box.fillGradient.colors.join(", ")})`
          : `radial-gradient(circle, ${box.fillGradient.colors.join(", ")})`
        : box.fill || "transparent";
      const sliceOffsetY = elementSlice?.offsetY ?? 0;
      const isSliced =
        sliceOffsetY > 0 || Boolean(elementSlice && elementSlice.height < box.height);

      if (isSliced) {
        const strokeStyle = box.strokeWidth
          ? `border: ${box.strokeWidth}px ${box.strokeStyle || "solid"} ${box.stroke || "transparent"}`
          : "";
        return `
        <div style="${commonStyle}">
          <div style="
            position: absolute;
            left: 0;
            top: ${-sliceOffsetY}px;
            width: 100%;
            height: ${box.height}px;
            background: ${fillCss};
            ${strokeStyle};
            border-radius: ${box.radius || 0}px;
            opacity: ${box.opacity ?? 1};
            box-sizing: border-box;
          "></div>
        </div>`;
      }

      const strokeStyleOuter = box.strokeWidth
        ? `border: ${box.strokeWidth}px ${box.strokeStyle || "solid"} ${box.stroke || "transparent"}`
        : "";
      return `
        <div style="${commonStyle}
          background: ${fillCss};
          ${strokeStyleOuter};
          border-radius: ${box.radius || 0}px;
          opacity: ${box.opacity ?? 1};
        "></div>
      `;
    }

    if (el.type === "path") {
      const pathEl = el as Extract<TemplateElement, { type: "path" }>;
      const pathD = pathEl.pathData || "";
      if (!pathD) return "";
      const fill = pathEl.fill || "transparent";
      const sliceOffsetY = elementSlice?.offsetY ?? 0;
      const isSliced =
        sliceOffsetY > 0 || Boolean(elementSlice && elementSlice.height < pathEl.height);
      const svgInner = `
            <svg width="${pathEl.width}" height="${pathEl.height}" viewBox="0 0 ${pathEl.width} ${pathEl.height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="opacity: ${pathEl.opacity ?? 1};">
              <path d="${pathD}" fill="${fill}" />
            </svg>`;
      if (isSliced) {
        return `
        <div style="${commonStyle}">
          <div style="position: absolute; left: 0; top: ${-sliceOffsetY}px; width: 100%; height: ${pathEl.height}px;">
            ${svgInner}
          </div>
        </div>`;
      }
      return `
        <div style="${commonStyle}">
          ${svgInner}
        </div>
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
            font-family: ${inp.fontFamily || "Inter"};
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
            font-family: ${curr.fontFamily || "Inter"};
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
        const qrValue = String(value ?? "").trim();
        const qrUrl = qrValue
          ? buildQrCodeImageUrl(qrValue, {
              size: Math.max(96, Math.min(512, Math.round(Math.max(el.width, el.height)))),
              foregroundColor: qr.foregroundColor,
              backgroundColor: qr.backgroundColor,
              errorCorrection: qr.errorCorrection,
            })
          : null;
        return `
          <div style="${commonStyle}; background: ${qr.backgroundColor}; color: ${qr.foregroundColor}; border: 1px solid #d1d5db; display: grid; place-items: center; font-size: 10px; font-weight: 700;" title="${String(value ?? "")}">
            ${
              qrUrl
                ? `<img src="${qrUrl}" alt="QR code" style="width:100%;height:100%;object-fit:contain;" />`
                : "QR"
            }
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
        const columnTracks = getTableGridTemplateColumns(el.columns);
        const headerTextBehavior = normalizeTableTextBehavior(el.headerStyle?.textBehavior, "wrap");
        const rowTextBehavior = normalizeTableTextBehavior(el.rowStyle?.textBehavior, "wrap");
        const headerTextCss = getTableTextBehaviorInlineCss(headerTextBehavior);
        const rowTextCss = getTableTextBehaviorInlineCss(rowTextBehavior);
        const normalizeTableFontWeight = (value: unknown): string => {
          if (value === "semibold") return "600";
          if (value === "medium") return "500";
          if (value === "bold") return "700";
          if (value === "normal") return "400";
          return "400";
        };
        const headerTypographyCss = `font-family:${el.headerStyle?.fontFamily || "Inter"};font-size:${el.headerStyle?.fontSize || 10}px;font-weight:${normalizeTableFontWeight(el.headerStyle?.fontWeight)};color:${el.headerStyle?.color || "#374151"};`;
        const rowTypographyCss = `font-family:${el.rowStyle?.fontFamily || "Inter"};font-size:${el.rowStyle?.fontSize || 10}px;font-weight:${normalizeTableFontWeight(el.rowStyle?.fontWeight)};color:${el.rowStyle?.color || "#374151"};`;
        const headerIsMultiline = ["wrap", "break-words", "clamp"].includes(headerTextBehavior.mode);
        const rowIsMultiline = ["wrap", "break-words", "clamp"].includes(rowTextBehavior.mode);
        const headerOverflowVisible = ["wrap", "break-words"].includes(headerTextBehavior.mode);
        const rowOverflowVisible = ["wrap", "break-words"].includes(rowTextBehavior.mode);
        const allItems = (getValueFromContextOrData(el.itemsBinding, dataContext, invoice.data) as Array<Record<string, unknown>>) || [];

        const layoutWidth = (() => {
          const clampedX = Math.max(margins.left, Math.min(el.x, size.width - margins.right));
          const maxWidth = Math.max(0, size.width - margins.right - clampedX);
          return Math.max(0, Math.min(el.width, maxWidth));
        })();
        const runtimeLayout = computeTableRuntimeLayout(el, invoice.data as unknown, {
          layoutWidth,
        });
        const rowHeights = runtimeLayout.rowHeights;

        const tableSlice = page.tableSlices[el.id];
        const items = tableSlice ? allItems.slice(tableSlice.start, tableSlice.end) : allItems;
        const showTotals = tableSlice ? tableSlice.isLastSlice : true;

        const columnsHTML = el.columns.map((col) => `
          <div style="padding: 4px; min-width: 0; display: flex; align-items: ${headerIsMultiline ? "flex-start" : "center"}; overflow: ${headerOverflowVisible ? "visible" : "hidden"};"><span style="${headerTextCss}${headerTypographyCss}">${col.header}</span></div>
        `).join("");

        const rowsHTML = items.map((row, idx) => {
          const actualIdx = tableSlice ? tableSlice.start + idx : idx;
          const rowMinHeight = rowHeights[actualIdx] ?? el.rowHeight;
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
            <div style="padding: 4px; display: flex; align-items: ${rowIsMultiline ? "flex-start" : "center"}; justify-content: ${justify}; min-height: 20px; min-width: 0; overflow: ${rowOverflowVisible ? "visible" : "hidden"};">
              <span style="${rowTextCss}${rowTypographyCss}">${text}</span>
            </div>
          `;
        }).join("");

          const borderStyle = el.stripe && actualIdx % 2 === 1 ? "1px solid #f3f4f6" : "1px solid #e5e7eb";

        return `
          <div style="
            display: grid;
            grid-template-columns: ${columnTracks};
            border-bottom: ${borderStyle};
            min-height: ${rowMinHeight}px;
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
              "align-items": rowIsMultiline ? "flex-start" : "center",
              "justify-content": col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
              "min-width": "0",
              overflow: rowOverflowVisible ? "visible" : "hidden",
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
              <span style="${rowTextCss}${rowTypographyCss}">${text}</span>
            </div>
          `;
        }).join("");
        
        totalsHTML = `
          <div style="
            display: grid;
            grid-template-columns: ${columnTracks};
            border-bottom: 1px solid #e5e7eb;
            min-height: ${runtimeLayout.totalRowHeight}px;
          ">
            ${totalsCellsHTML}
          </div>
        `;
      }

      // Calculate actual table height for this slice
        const headerHeight = el.headerHeight || 28;
        const sliceBodyHeight = items.reduce((sum, _, idx) => {
          const actualIdx = tableSlice ? tableSlice.start + idx : idx;
          return sum + (rowHeights[actualIdx] ?? el.rowHeight);
        }, 0);
        const totalsHeight = totalsHTML ? runtimeLayout.totalRowHeight : 0;
        const totalTableHeight = headerHeight + sliceBodyHeight + totalsHeight;
        
        return `
          <div style="${commonStyle}; height: ${totalTableHeight}px;">
            <div style="width: 100%; height: 100%; font-size: 10px; color: #374151; overflow: visible;">
          <div style="
            display: grid;
            grid-template-columns: ${columnTracks};
            border-bottom: 1px solid #e5e7eb;
            min-height: ${el.headerHeight}px;
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
    return bgHtml + contentHtml;
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
  const googleFontLinks = buildGoogleFontLinks();

  // Complete HTML document with multiple pages
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        ${googleFontLinks}
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
 * 1. Fetches the invoice and resolves a frozen template snapshot
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
  const storage = getStorage();
  const bucket = storage.bucket();

  // Fetch invoice
  const invoice = await invoiceRepository.get({ id: invoiceId });
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const fileName = `invoices/${invoice.orgId}/${invoiceId}.pdf`;
  const file = bucket.file(fileName);
  const encodedPath = encodeURIComponent(fileName);
  const buildDownloadUrl = (token: string): string =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
  const getOrCreateDownloadToken = async (): Promise<string> => {
    const [metadata] = await file.getMetadata();
    const existingTokensRaw = metadata.metadata?.firebaseStorageDownloadTokens;
    const existingTokens = typeof existingTokensRaw === "string" ? existingTokensRaw : "";
    const firstToken = existingTokens
      .split(",")
      .map((token: string) => token.trim())
      .find((token: string) => token.length > 0);

    if (firstToken) {
      return firstToken;
    }

    const newToken = randomUUID();
    await file.setMetadata({
      metadata: {
        ...(metadata.metadata ?? {}),
        firebaseStorageDownloadTokens: newToken,
      },
    });

    return newToken;
  };

  // Fast path for existing PDFs:
  // - reuse current file when it is newer than the invoice record
  // - ensure a stable Firebase download token exists
  const [fileExists] = await file.exists();
  if (fileExists) {
    let fileGeneratedAtMs = Number.NaN;
    try {
      const [metadata] = await file.getMetadata();
      const generatedAt = metadata.metadata?.generatedAt ?? metadata.updated;
      const generatedAtString = typeof generatedAt === "string" ? generatedAt : "";
      fileGeneratedAtMs = Date.parse(generatedAtString);
    } catch {
      // Continue with fallback behavior below.
    }

    const invoiceUpdatedAtMs = Date.parse(invoice.updatedAt || invoice.createdAt || "");
    const hasTimestamps = Number.isFinite(fileGeneratedAtMs) && Number.isFinite(invoiceUpdatedAtMs);
    const shouldReuseExistingPdf = hasTimestamps ? fileGeneratedAtMs >= invoiceUpdatedAtMs : true;

    if (shouldReuseExistingPdf) {
      const token = await getOrCreateDownloadToken();
      const downloadUrl = buildDownloadUrl(token);

      if (invoice.pdfUrl !== downloadUrl) {
        await invoiceRepository.update({
          id: invoiceId,
          data: { pdfUrl: downloadUrl } as Partial<Invoice>,
        });
      }

      return downloadUrl;
    }
  }

  // Resolve frozen template snapshot, with fallbacks for legacy invoices.
  let template: TemplateData | null = invoice.templateSnapshot ?? null;

  if (!template && invoice.templateVersionId) {
    template = await loadTemplateSnapshotFromVersionId({
      databaseService,
      templateVersionId: invoice.templateVersionId,
      templateId: invoice.templateId,
      orgId: invoice.orgId,
    });
  }

  if (!template) {
    template = await loadLatestTemplateSnapshotVersion({
      databaseService,
      templateId: invoice.templateId,
      orgId: invoice.orgId,
    });
  }

  if (!template) {
    template = await loadLiveTemplateSnapshot({
      templateId: invoice.templateId,
      orgId: invoice.orgId,
    });
  }

  if (!template) {
    throw new Error(
      `Template snapshot not found for invoice ${invoiceId}. Original template ${invoice.templateId} is unavailable.`
    );
  }

  // Backfill snapshot for legacy invoices so subsequent renders are template-independent.
  if (!invoice.templateSnapshot) {
    try {
      await invoiceRepository.update({
        id: invoiceId,
        data: { templateSnapshot: template } as Partial<Invoice>,
      });
    } catch {
      // Ignore backfill failures; PDF generation can proceed with in-memory snapshot.
    }
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
      // chromium.args already includes the required headless-shell and sandbox flags.
      args: [...chromium.args],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      executablePath,
      // Avoid Puppeteer adding a second headless mode flag that conflicts with
      // @sparticuz/chromium's shell-only headless runtime configuration.
      headless: false,
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

  const downloadToken = randomUUID();
  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: {
        invoiceId,
        templateId: invoice.templateId,
        generatedAt: new Date().toISOString(),
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });
  const downloadUrl = buildDownloadUrl(downloadToken);

  // Update invoice with PDF URL
  await invoiceRepository.update({
    id: invoiceId,
    data: { pdfUrl: downloadUrl } as Partial<Invoice>,
  });

  return downloadUrl;
}

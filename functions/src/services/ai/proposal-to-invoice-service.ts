/**
 * Service for converting proposals to invoices using AI
 * Maps proposal data to invoice template structure intelligently
 * Enhanced with compliance enforcement, region-specific rules, and comprehensive validation
 */

import { AIService } from "./ai-service";
import { Proposal, Organization } from "../../core";
import { Template, TemplateElement } from "../../core/entities/template";
import { loggerService } from "../logger-service";
import { getBindingValue, setBindingValue } from "../../core/entities/invoice";
import type { InvoiceDataValue } from "../../core/entities/invoice";
import type { ProposalItem } from "../../core/entities/proposal";
import { invoiceComplianceService } from "../invoice-compliance-service";
import type { InvoiceRegion } from "../../core/entities/invoice-compliance";

export interface ProposalToInvoiceResult {
  invoiceData: Record<string, InvoiceDataValue>;
  invoiceNumber?: string;
}

export class ProposalToInvoiceService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Convert a proposal to invoice data matching a template's bindings
   */
  async convertProposalToInvoice(
    proposal: Proposal,
    template: Template,
    organization: Organization,
    lead?: { data?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; message?: string } }
  ): Promise<ProposalToInvoiceResult> {
    try {
      // Extract template bindings
      const templateBindings = this.extractTemplateBindings(template);
      
      // Detect compliance region
      // Note: detectRegion expects country code string, not an object
      const customerCountry = lead?.data?.company ? undefined : undefined; // Company name is not a country code
      const region = invoiceComplianceService.detectRegion(organization, customerCountry);
      
      // Build comprehensive context for AI
      const context = this.buildConversionContext(proposal, organization, lead, template);
      
      // Build enhanced AI prompt with compliance rules
      const prompt = this.buildConversionPrompt(context, templateBindings, template, region);
      
      // Define schema for AI response
      const schema = {
        type: "object" as const,
        properties: {
          invoiceData: {
            type: "object" as const,
            description: "Invoice data matching template bindings",
          },
          invoiceNumber: {
            type: "string" as const,
            description: "Generated invoice number",
          },
        },
        required: ["invoiceData"],
      };
      
      // Generate invoice data using AI
      const result = await this.aiService.generateJSON<{
        invoiceData: Record<string, unknown>;
        invoiceNumber?: string;
      }>(prompt, schema, {
        temperature: 0.3, // Lower temperature for more consistent conversion
        maxTokens: 8192,
      });
      
      // Process and validate the result
      const invoiceData = this.processInvoiceData(
        result.invoiceData as Record<string, InvoiceDataValue>,
        proposal,
        template,
        organization,
        lead
      );
      
      return {
        invoiceData,
        invoiceNumber: result.invoiceNumber,
      };
    } catch (error) {
      loggerService.error("Failed to convert proposal to invoice", {
        error: error instanceof Error ? error.message : "Unknown error",
        proposalId: proposal.id,
        templateId: template.id,
      });
      throw new Error(
        `Failed to convert proposal to invoice: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract all bindings from template
   */
  private extractTemplateBindings(template: Template): Set<string> {
    const bindings = new Set<string>();
    const elements = template.elements ?? [];
    
    for (const element of elements) {
      if (element.type === "text") {
        const textEl = element as Extract<TemplateElement, { type: "text" }>;
        if (textEl.binding) {
          bindings.add(textEl.binding);
        }
      } else if (element.type === "input") {
        const inputEl = element as Extract<TemplateElement, { type: "input" }>;
        if (inputEl.binding) {
          bindings.add(inputEl.binding);
        }
      } else if (element.type === "currency") {
        const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
        if (currencyEl.binding) {
          bindings.add(currencyEl.binding);
        }
      } else if (element.type === "image") {
        // Image elements may have optional binding property
        const imageEl = element as Extract<TemplateElement, { type: "image" }> & { binding?: string };
        if (imageEl.binding) {
          bindings.add(imageEl.binding);
        }
      } else if (element.type === "table") {
        const tableEl = element as Extract<TemplateElement, { type: "table" }>;
        if (tableEl.itemsBinding) {
          bindings.add(tableEl.itemsBinding);
          // Also add column bindings
          for (const col of tableEl.columns) {
            if (col.binding) {
              bindings.add(`${tableEl.itemsBinding}.${col.binding}`); // For reference, but items are arrays
            }
          }
        }
      }
    }
    
    return bindings;
  }

  /**
   * Build comprehensive context string for AI conversion
   * Includes organization, proposal, compliance rules, and branding information
   */
  private buildConversionContext(
    proposal: Proposal,
    organization: Organization,
    lead?: { data?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; message?: string } },
    template?: Template
  ): string {
    const parts: string[] = [];
    
    // Detect compliance region
    // Note: detectRegion expects country code string, not an object
    const customerCountry = undefined; // Lead data doesn't contain country code
    const region = invoiceComplianceService.detectRegion(organization, customerCountry);
    const complianceRules = this.getComplianceRules(region);
    
    // Organization info (seller/supplier)
    parts.push("=== ORGANIZATION (SELLER/SUPPLIER) ===");
    if (organization.name) {
      parts.push(`Name: ${organization.name}`);
    }
    if (organization.settings?.address) {
      const addr = organization.settings.address;
      const addressParts = [
        addr.street,
        addr.city,
        addr.state,
        addr.zipCode,
        addr.country,
      ].filter(Boolean);
      if (addressParts.length > 0) {
        parts.push(`Address: ${addressParts.join(", ")}`);
      }
      // Also provide structured address
      if (addr.street) parts.push(`Address Street: ${addr.street}`);
      if (addr.city) parts.push(`Address City: ${addr.city}`);
      if (addr.state) parts.push(`Address State: ${addr.state}`);
      if (addr.zipCode) parts.push(`Address ZIP: ${addr.zipCode}`);
      if (addr.country) parts.push(`Address Country: ${addr.country}`);
    }
    if (organization.settings?.email) {
      parts.push(`Email: ${organization.settings.email}`);
    }
    if (organization.settings?.phone) {
      parts.push(`Phone: ${organization.settings.phone}`);
    }
    if (organization.settings?.defaultCurrency) {
      parts.push(`Default Currency: ${organization.settings.defaultCurrency}`);
    }
    // VAT/Tax ID (if available in organization settings)
    if (organization.settings?.region) {
      parts.push(`Region: ${organization.settings.region}`);
    }
    
    // Branding information
    if (organization.settings?.brandColors) {
      parts.push(`\nBrand Colors:`);
      parts.push(`Primary: ${organization.settings.brandColors.primary}`);
      parts.push(`Secondary: ${organization.settings.brandColors.secondary}`);
      parts.push(`Accent: ${organization.settings.brandColors.accent}`);
    }
    if (organization.settings?.branding?.customLogo) {
      parts.push(`Logo URL: ${organization.settings.branding.customLogo}`);
    }
    
    // Proposal info
    parts.push(`\n=== PROPOSAL INFORMATION ===`);
    parts.push(`Proposal ID: ${proposal.id}`);
    parts.push(`Title: ${proposal.title}`);
    if (proposal.description) {
      parts.push(`Description: ${proposal.description}`);
    }
    parts.push(`Currency: ${proposal.currency}`);
    parts.push(`Subtotal: ${proposal.subtotal} ${proposal.currency}`);
    if (proposal.taxTotal > 0) {
      parts.push(`Tax Total: ${proposal.taxTotal} ${proposal.currency}`);
      const taxRate = proposal.subtotal > 0 ? (proposal.taxTotal / proposal.subtotal) * 100 : 0;
      parts.push(`Tax Rate: ${taxRate.toFixed(2)}%`);
    }
    parts.push(`Total: ${proposal.total} ${proposal.currency}`);
    if (proposal.terms) {
      parts.push(`Payment Terms: ${proposal.terms}`);
    }
    if (proposal.notes) {
      parts.push(`Notes: ${proposal.notes}`);
    }
    
    // Proposal items with detailed breakdown
    parts.push(`\n=== PROPOSAL ITEMS (${proposal.items.length} items) ===`);
    proposal.items.forEach((item: ProposalItem, idx: number) => {
      parts.push(`\nItem ${idx + 1}:`);
      parts.push(`  Description: ${item.description}`);
      parts.push(`  Quantity: ${item.qty}`);
      parts.push(`  Unit Price: ${item.unitPrice} ${proposal.currency}`);
      const itemSubtotal = item.qty * item.unitPrice;
      parts.push(`  Subtotal: ${itemSubtotal.toFixed(2)} ${proposal.currency}`);
      if (item.taxPct && item.taxPct > 0) {
        parts.push(`  Tax Rate: ${item.taxPct}%`);
        const itemTax = (itemSubtotal * item.taxPct) / 100;
        parts.push(`  Tax Amount: ${itemTax.toFixed(2)} ${proposal.currency}`);
      }
      const itemTotal = itemSubtotal * (1 + (item.taxPct || 0) / 100);
      parts.push(`  Total: ${itemTotal.toFixed(2)} ${proposal.currency}`);
    });
    
    // Lead/Client info (buyer/customer)
    if (lead?.data) {
      parts.push(`\n=== CLIENT INFORMATION (BUYER/CUSTOMER) ===`);
      const clientName = lead.data.company || 
                        [lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ") ||
                        "Unknown";
      parts.push(`Name: ${clientName}`);
      if (lead.data.company && (lead.data.firstName || lead.data.lastName)) {
        parts.push(`Contact Person: ${[lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ")}`);
      }
      if (lead.data.email) {
        parts.push(`Email: ${lead.data.email}`);
      }
      if (lead.data.phone) {
        parts.push(`Phone: ${lead.data.phone}`);
      }
      if (lead.data.message) {
        parts.push(`Message/Notes: ${lead.data.message}`);
      }
    }
    
    // Compliance rules and region requirements
    parts.push(`\n=== COMPLIANCE REQUIREMENTS ===`);
    parts.push(`Region: ${region}`);
    parts.push(`Compliance Rules:`);
    parts.push(`  - VAT Number Required: ${complianceRules.requireVatNumber ? "YES" : "NO"}`);
    parts.push(`  - Invoice Number Sequence: ${complianceRules.requireInvoiceNumberSequence ? "MANDATORY" : "RECOMMENDED"}`);
    parts.push(`  - Issue Date Required: ${complianceRules.requireIssueDate ? "YES" : "NO"}`);
    parts.push(`  - Due Date Required: ${complianceRules.requireDueDate ? "YES" : "NO"}`);
    parts.push(`  - Date Format: ${complianceRules.dateFormat}`);
    parts.push(`  - Tax Type: ${complianceRules.taxType}`);
    parts.push(`  - Default Tax Rate: ${complianceRules.defaultTaxRate}%`);
    parts.push(`  - Currency Symbol: ${complianceRules.currencySymbol}`);
    
    // Template context
    if (template) {
      parts.push(`\n=== TEMPLATE CONTEXT ===`);
      parts.push(`Template Name: ${template.name || template.id}`);
      if (template.compliance?.region) {
        parts.push(`Template Region: ${template.compliance.region}`);
      }
    }
    
    return parts.join("\n");
  }
  
  /**
   * Get compliance rules for a specific region
   */
  private getComplianceRules(region: InvoiceRegion): {
    requireVatNumber: boolean;
    requireInvoiceNumberSequence: boolean;
    requireIssueDate: boolean;
    requireDueDate: boolean;
    dateFormat: string;
    taxType: string;
    defaultTaxRate: number;
    currencySymbol: string;
  } {
    switch (region) {
      case "EU":
        return {
          requireVatNumber: true,
          requireInvoiceNumberSequence: true,
          requireIssueDate: true,
          requireDueDate: true,
          dateFormat: "YYYY-MM-DD",
          taxType: "VAT",
          defaultTaxRate: 20,
          currencySymbol: "€",
        };
      case "US":
        return {
          requireVatNumber: false,
          requireInvoiceNumberSequence: false,
          requireIssueDate: true,
          requireDueDate: false,
          dateFormat: "YYYY-MM-DD",
          taxType: "Sales Tax",
          defaultTaxRate: 0,
          currencySymbol: "$",
        };
      case "CA":
        return {
          requireVatNumber: false,
          requireInvoiceNumberSequence: false,
          requireIssueDate: true,
          requireDueDate: false,
          dateFormat: "YYYY-MM-DD",
          taxType: "GST/HST",
          defaultTaxRate: 13,
          currencySymbol: "C$",
        };
      case "AU":
        return {
          requireVatNumber: true,
          requireInvoiceNumberSequence: false,
          requireIssueDate: true,
          requireDueDate: false,
          dateFormat: "YYYY-MM-DD",
          taxType: "GST",
          defaultTaxRate: 10,
          currencySymbol: "A$",
        };
      case "UK":
        return {
          requireVatNumber: true,
          requireInvoiceNumberSequence: true,
          requireIssueDate: true,
          requireDueDate: true,
          dateFormat: "YYYY-MM-DD",
          taxType: "VAT",
          defaultTaxRate: 20,
          currencySymbol: "£",
        };
      default:
        return {
          requireVatNumber: false,
          requireInvoiceNumberSequence: false,
          requireIssueDate: true,
          requireDueDate: false,
          dateFormat: "YYYY-MM-DD",
          taxType: "Tax",
          defaultTaxRate: 0,
          currencySymbol: "$",
        };
    }
  }

  /**
   * Build enhanced AI prompt for conversion with compliance enforcement
   */
  private buildConversionPrompt(
    context: string,
    templateBindings: Set<string>,
    template: Template,
    region: InvoiceRegion
  ): string {
    const bindingsList = Array.from(templateBindings).sort().join(", ");
    const complianceRules = this.getComplianceRules(region);
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split("T")[0];
    
    return `You are Financely's AI finance assistant specialized in generating compliant invoices from proposals.

Your job is to take a proposal and produce a fully compliant, branded invoice using the organization's template, region rules (${region}), and brand context.

🎯 GOAL
Generate a structured and compliant invoice JSON object that can be rendered into a template.
Follow all legal, financial, and formatting requirements based on the region (${region}).

🧩 INPUT CONTEXT
${context}

🧮 YOUR TASKS

1. Understand the Proposal
   - Extract all service line items, quantities, and pricing from the proposal items.
   - Derive subtotal, tax, and total according to the regional tax rules (${complianceRules.taxType} for ${region}).
   - If tax rate is missing from proposal items, use default: ${complianceRules.defaultTaxRate}% for ${region}.

2. Generate a Structured Invoice
   - Output only a valid JSON object matching the template bindings.
   - Template Bindings Required: ${bindingsList}
   - Use EXACT binding names from the template (e.g., if template uses "buyer.name", use that, not "customer.name").

CRITICAL: Data Accuracy Rules
- Use ONLY data from the proposal, organization, and lead/client information provided in the context
- DO NOT invent or hallucinate data that is not explicitly provided
- If a field is missing from the context (e.g., customer address), use null or omit it - DO NOT make up addresses, phone numbers, VAT IDs, or other details
- Use exact values from the proposal items - do not modify quantities or prices unless calculating totals
- Use exact organization data from the context - do not invent company names, addresses, or contact information

3. Enforce Compliance by Region (${region})
   ${region === "EU" ? `
   - MUST include invoice number with sequential format (e.g., "INV-2025-0012")
   - MUST include VAT numbers for both seller and buyer if available
   - MUST include issue date and due date
   - Currency format: ${complianceRules.currencySymbol}
   - Tax type: VAT (Value Added Tax)
   ` : region === "US" ? `
   - Include EIN or Tax ID if available
   - Invoice number sequence recommended
   - Currency format: ${complianceRules.currencySymbol}
   - Tax type: Sales Tax (may be 0% if not specified)
   ` : `
   - Follow ${region} compliance requirements
   - Currency format: ${complianceRules.currencySymbol}
   - Tax type: ${complianceRules.taxType}
   `}

4. CRITICAL MAPPING RULES:
   a) Map proposal items to invoice items array:
      - proposal.items[].description → invoiceData.items[].description
      - proposal.items[].qty → invoiceData.items[].quantity (or invoiceData.items[].qty)
      - proposal.items[].unitPrice → invoiceData.items[].unitPrice (or invoiceData.items[].price)
      - Calculate invoiceData.items[].total = quantity * unitPrice * (1 + taxRate/100)
      - Include taxPct and tax amount per item if applicable

   b) Map customer/client information:
      - If template has "customer.name" or "buyer.name": Use lead company name or full name
      - If template has "customer.email" or "buyer.email": Use lead email
      - If template has "customer.phone" or "buyer.phone": Use lead phone if available
      - If template has "customer.address" or "buyer.address": Construct structured address object with fields: { street, city, state, zipCode, country }
        * If address data is not available in lead, use null or omit - DO NOT use "undefined", "TBD", or "[object Object]"
        * Address must be a proper object, not a string
      - If template has "customer.vatId" or "buyer.vatId" or "customer.vatNumber" or "buyer.vatNumber": 
        * Include if available from lead formData (${complianceRules.requireVatNumber ? "REQUIRED for " + region : "optional"})
        * If not available, use null or omit - DO NOT use "undefined" or "TBD"

   c) Map seller/supplier information:
      - Use organization name, address, email, phone from context
      - Map to "seller.name", "supplier.name", "seller.address", etc. based on template bindings
      - If template has "seller.address" or "supplier.address": Create structured address object: { street, city, state, zipCode, country }
        * Use organization address from context - all fields are provided separately
        * Address must be a proper object, not a string
      - If template has "seller.vatId" or "supplier.vatId" or "seller.vatNumber" or "supplier.vatNumber": 
        * Include organization VAT/Tax ID if available from context
        * If not available, use null or omit - DO NOT use "undefined" or "TBD"

   d) Map financial totals:
      - proposal.subtotal → invoiceData.subtotal or invoiceData.netAmount
      - proposal.taxTotal → invoiceData.vatTotal or invoiceData.taxTotal
      - proposal.total → invoiceData.total or invoiceData.grossTotal
      - CRITICAL: Ensure subtotal + tax.amount = total (validate this calculation)

   e) Map dates:
      - invoiceDate or issueDate: Use current date (${today}) in YYYY-MM-DD format
      - dueDate: Calculate based on payment terms or use ${dueDateStr} (30 days from today)
      - Both dates are ${complianceRules.requireIssueDate && complianceRules.requireDueDate ? "MANDATORY" : "required"}

   f) Map currency:
      - proposal.currency → invoiceData.currency
      - Ensure currency code matches proposal currency

   g) Generate invoice number:
      - Create a professional, sequential invoice number
      - Format: "INV-YYYY-NNNN" (e.g., "INV-2025-0012") or "INV-{timestamp}"
      - ${complianceRules.requireInvoiceNumberSequence ? "MANDATORY - must be sequential" : "Recommended"}

   h) Map payment terms and notes:
      - proposal.terms → invoiceData.terms or invoiceData.paymentTerms
      - proposal.notes → invoiceData.notes
      - Include proposal reference if template has "proposalReference" or "proposalId" binding

5. Branding & Localization
   - Embed brand context fields (primary_color, accent_color, font, logo_url) if template bindings support them
   - Use organization's brand colors from context
   - Localize currency and date formats according to region

6. Error Prevention
   - Do NOT omit required fields from template bindings
   - Validate that subtotal + tax.amount = total (within 0.01 tolerance for rounding)
   - If uncertain about a value, use placeholder "TBD" but keep structure intact
   - Ensure all numeric values are numbers, not strings
   - Dates must be in YYYY-MM-DD format
   - Currency code must be valid ISO code (e.g., "EUR", "USD", "GBP")

7. Final Validation
   - Ensure the JSON is machine-parseable
   - Only include fields that exist in the template bindings
   - For nested objects (like seller.address), create the full object structure with all sub-fields
   - Return *only the JSON object* — no explanations, no extra text

⚖️ REGION RULES SUMMARY (${region})
- VAT Number Required: ${complianceRules.requireVatNumber ? "YES" : "NO"}
- Invoice Number Sequence: ${complianceRules.requireInvoiceNumberSequence ? "MANDATORY" : "RECOMMENDED"}
- Issue Date Required: ${complianceRules.requireIssueDate ? "YES" : "NO"}
- Due Date Required: ${complianceRules.requireDueDate ? "YES" : "NO"}
- Date Format: ${complianceRules.dateFormat}
- Tax Type: ${complianceRules.taxType}
- Default Tax Rate: ${complianceRules.defaultTaxRate}%
- Currency Symbol: ${complianceRules.currencySymbol}

Generate a JSON object with:
- invoiceData: Object matching ALL template bindings with proper structure
- invoiceNumber: Generated invoice number (${complianceRules.requireInvoiceNumberSequence ? "MANDATORY" : "recommended"})

Respond with valid JSON only. No explanations, no markdown, just the JSON object.`;
  }

  /**
   * Process and enrich AI-generated invoice data
   */
  private processInvoiceData(
    aiData: Record<string, InvoiceDataValue>,
    proposal: Proposal,
    template: Template,
    organization: Organization,
    lead?: { data?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string } }
  ): Record<string, InvoiceDataValue> {
    const invoiceData: Record<string, InvoiceDataValue> = { ...aiData };
    
    // Ensure items array is properly formatted
    if (invoiceData.items && Array.isArray(invoiceData.items)) {
      const itemsArray = invoiceData.items as Array<Record<string, InvoiceDataValue>>;
      invoiceData.items = proposal.items.map((item: ProposalItem) => {
        const existingItem = itemsArray.find(
          (invItem: Record<string, InvoiceDataValue>) =>
            typeof invItem === "object" && invItem !== null && 
            (invItem.description === item.description || invItem.description === item.description)
        ) as Record<string, InvoiceDataValue> | undefined;
        
        // Use AI-generated item if available, otherwise create from proposal
        const mappedItem: Record<string, InvoiceDataValue> = existingItem || {};
        
        // Map proposal item fields to invoice item
        mappedItem.description = item.description;
        mappedItem.quantity = item.qty;
        mappedItem.qty = item.qty; // Support both
        mappedItem.unitPrice = item.unitPrice;
        mappedItem.price = item.unitPrice; // Support both
        mappedItem.total = item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100);
        mappedItem.amount = mappedItem.total; // Support both
        mappedItem.currency = proposal.currency;
        
        if (item.taxPct && item.taxPct > 0) {
          mappedItem.taxPct = item.taxPct;
          mappedItem.tax = (item.qty * item.unitPrice * item.taxPct) / 100;
        }
        
        return mappedItem;
      });
    } else {
      // Create items array from proposal if not in AI response
      invoiceData.items = proposal.items.map((item: ProposalItem) => ({
        description: item.description,
        quantity: item.qty,
        qty: item.qty,
        unitPrice: item.unitPrice,
        price: item.unitPrice,
        total: item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100),
        amount: item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100),
        currency: proposal.currency,
        ...(item.taxPct && item.taxPct > 0 ? {
          taxPct: item.taxPct,
          tax: (item.qty * item.unitPrice * item.taxPct) / 100,
        } : {}),
      }));
    }
    
    // Ensure totals are correct with validation
    const calculatedSubtotal = proposal.items.reduce((sum: number, item: ProposalItem) => sum + item.qty * item.unitPrice, 0);
    const calculatedTax = proposal.items.reduce(
      (sum: number, item: ProposalItem) => sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
      0
    );
    const calculatedTotal = calculatedSubtotal + calculatedTax;
    
    // Validate totals match (within 0.01 tolerance for rounding)
    const existingSubtotal = (invoiceData.subtotal as number) || (invoiceData.netAmount as number) || 0;
    const existingTax = (invoiceData.vatTotal as number) || (invoiceData.taxTotal as number) || 0;
    const existingTotal = (invoiceData.total as number) || (invoiceData.grossTotal as number) || 0;
    
    const totalDifference = Math.abs(existingTotal - (existingSubtotal + existingTax));
    if (totalDifference > 0.01 && existingTotal > 0) {
      loggerService.warn("Invoice totals mismatch, correcting", {
        existingSubtotal,
        existingTax,
        existingTotal,
        calculatedSubtotal,
        calculatedTax,
        calculatedTotal,
        difference: totalDifference,
      });
    }
    
    // Set totals (support multiple binding names) - prefer calculated values for accuracy
    if (!invoiceData.subtotal && !invoiceData.netAmount) {
      invoiceData.subtotal = Math.round(calculatedSubtotal * 100) / 100; // Round to 2 decimals
    } else if (Math.abs(existingSubtotal - calculatedSubtotal) > 0.01) {
      // Correct if significantly different
      invoiceData.subtotal = Math.round(calculatedSubtotal * 100) / 100;
    }
    
    if (!invoiceData.total && !invoiceData.grossTotal) {
      invoiceData.total = Math.round(calculatedTotal * 100) / 100;
    } else if (Math.abs(existingTotal - calculatedTotal) > 0.01) {
      // Correct if significantly different
      invoiceData.total = Math.round(calculatedTotal * 100) / 100;
    }
    
    if (calculatedTax > 0) {
      if (!invoiceData.vatTotal && !invoiceData.taxTotal) {
        invoiceData.vatTotal = Math.round(calculatedTax * 100) / 100;
      } else if (Math.abs(existingTax - calculatedTax) > 0.01) {
        // Correct if significantly different
        invoiceData.vatTotal = Math.round(calculatedTax * 100) / 100;
      }
    }
    
    // Ensure currency is set
    if (!invoiceData.currency) {
      invoiceData.currency = proposal.currency;
    }
    
    // Set dates if not present (ensure compliance)
    const today = new Date().toISOString().split("T")[0];
    if (!invoiceData.invoiceDate && !invoiceData.issueDate) {
      invoiceData.invoiceDate = today;
      invoiceData.issueDate = today; // Set both for compatibility
    } else if (invoiceData.invoiceDate && !invoiceData.issueDate) {
      invoiceData.issueDate = invoiceData.invoiceDate as string;
    } else if (invoiceData.issueDate && !invoiceData.invoiceDate) {
      invoiceData.invoiceDate = invoiceData.issueDate as string;
    }
    
    if (!invoiceData.dueDate) {
      // Calculate due date (30 days default, or parse from terms)
      const dueDate = new Date();
      // Try to extract payment terms (e.g., "Net 30", "Due in 15 days")
      const terms = proposal.terms || "";
      const netMatch = terms.match(/net\s+(\d+)/i);
      const daysMatch = terms.match(/(\d+)\s+days?/i);
      const days = netMatch ? parseInt(netMatch[1], 10) : (daysMatch ? parseInt(daysMatch[1], 10) : 30);
      dueDate.setDate(dueDate.getDate() + days);
      invoiceData.dueDate = dueDate.toISOString().split("T")[0];
    }
    
    // Map organization data to seller/supplier fields
    const sellerNameBinding = Array.from(this.extractTemplateBindings(template)).find(
      b => b === "seller.name" || b === "supplier.name"
    );
    if (sellerNameBinding && !getBindingValue(invoiceData, sellerNameBinding)) {
      setBindingValue(invoiceData, sellerNameBinding, organization.name || "");
    }
    
    const sellerAddressBinding = Array.from(this.extractTemplateBindings(template)).find(
      b => b === "seller.address" || b === "supplier.address"
    );
    if (sellerAddressBinding && organization.settings?.address) {
      const addr = organization.settings.address;
      const addressObj: Record<string, string> = {};
      if (addr.street) addressObj.street = addr.street;
      if (addr.city) addressObj.city = addr.city;
      if (addr.state) addressObj.state = addr.state;
      if (addr.zipCode) addressObj.zipCode = addr.zipCode;
      if (addr.country) addressObj.country = addr.country;
      if (Object.keys(addressObj).length > 0) {
        setBindingValue(invoiceData, sellerAddressBinding, addressObj);
      }
    }
    
    // Map lead data to customer/buyer fields
    if (lead?.data) {
      const customerNameBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "customer.name" || b === "buyer.name"
      );
      if (customerNameBinding) {
        const customerName = lead.data.company || 
                            [lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ") ||
                            "";
        if (customerName && !getBindingValue(invoiceData, customerNameBinding)) {
          setBindingValue(invoiceData, customerNameBinding, customerName);
        }
      }
      
      const customerEmailBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "customer.email" || b === "buyer.email"
      );
      if (customerEmailBinding && lead.data.email && !getBindingValue(invoiceData, customerEmailBinding)) {
        setBindingValue(invoiceData, customerEmailBinding, lead.data.email);
      }
      
      const customerPhoneBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "customer.phone" || b === "buyer.phone"
      );
      if (customerPhoneBinding && lead.data.phone && !getBindingValue(invoiceData, customerPhoneBinding)) {
        setBindingValue(invoiceData, customerPhoneBinding, lead.data.phone);
      }
      
      // Map customer address if available (from formData or other sources)
      const customerAddressBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "customer.address" || b === "buyer.address"
      );
      if (customerAddressBinding) {
        const existingAddress = getBindingValue(invoiceData, customerAddressBinding);
        // Only set if not already set by AI and if we have address data
        if (!existingAddress && lead.data) {
          // Try to construct address from available lead data
          // Note: Lead data might not have full address, but we can try
          const addressParts: string[] = [];
          if (lead.data.company) addressParts.push(lead.data.company);
          // If formData has address fields, use those
          const formData = (lead.data as any).formData;
          if (formData && typeof formData === "object") {
            const addrObj: Record<string, string> = {};
            if (formData.address || formData.street) addrObj.street = String(formData.address || formData.street || "");
            if (formData.city) addrObj.city = String(formData.city);
            if (formData.state) addrObj.state = String(formData.state);
            if (formData.zipCode || formData.zip) addrObj.zipCode = String(formData.zipCode || formData.zip || "");
            if (formData.country) addrObj.country = String(formData.country);
            if (Object.keys(addrObj).some(k => addrObj[k])) {
              setBindingValue(invoiceData, customerAddressBinding, addrObj);
            }
          }
        }
      }
      
      // Map customer VAT ID if available
      const customerVatIdBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "customer.vatId" || b === "buyer.vatId" || b === "customer.vatNumber" || b === "buyer.vatNumber"
      );
      if (customerVatIdBinding) {
        const existingVatId = getBindingValue(invoiceData, customerVatIdBinding);
        if (!existingVatId) {
          // Try to get VAT ID from formData
          const formData = (lead.data as any).formData;
          if (formData && typeof formData === "object") {
            const vatId = formData.vatId || formData.vatNumber || formData.taxId;
            if (vatId) {
              setBindingValue(invoiceData, customerVatIdBinding, String(vatId));
            }
          }
        }
      }
    }
    
    // Map seller VAT ID if available
    const sellerVatIdBinding = Array.from(this.extractTemplateBindings(template)).find(
      b => b === "seller.vatId" || b === "supplier.vatId" || b === "seller.vatNumber" || b === "supplier.vatNumber"
    );
    if (sellerVatIdBinding) {
      const existingVatId = getBindingValue(invoiceData, sellerVatIdBinding);
      if (!existingVatId) {
        // Try to get from organization settings (if available in future)
        // For now, leave it empty - user can fill manually
      }
    }
    
    // Map proposal terms and notes
    if (proposal.terms) {
      const termsBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "terms" || b === "paymentTerms"
      );
      if (termsBinding && !getBindingValue(invoiceData, termsBinding)) {
        setBindingValue(invoiceData, termsBinding, proposal.terms);
      }
    }
    
    if (proposal.notes) {
      const notesBinding = Array.from(this.extractTemplateBindings(template)).find(
        b => b === "notes"
      );
      if (notesBinding && !getBindingValue(invoiceData, notesBinding)) {
        setBindingValue(invoiceData, notesBinding, proposal.notes);
      }
    }
    
    return invoiceData;
  }
}


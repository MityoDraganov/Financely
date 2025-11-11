/**
 * Service for converting proposals to invoices using AI
 * Maps proposal data to invoice template structure intelligently
 */

import { AIService } from "./ai-service";
import { Proposal, Organization } from "../../core";
import { Template, TemplateElement } from "../../core/entities/template";
import { loggerService } from "../logger-service";
import { getBindingValue, setBindingValue } from "../../core/entities/invoice";
import type { InvoiceDataValue } from "../../core/entities/invoice";
import type { ProposalItem } from "../../core/entities/proposal";

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
      
      // Build context for AI
      const context = this.buildConversionContext(proposal, organization, lead);
      
      // Build AI prompt
      const prompt = this.buildConversionPrompt(context, templateBindings, template);
      
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
   * Build context string for AI conversion
   */
  private buildConversionContext(
    proposal: Proposal,
    organization: Organization,
    lead?: { data?: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; message?: string } }
  ): string {
    const parts: string[] = [];
    
    // Organization info
    if (organization.name) {
      parts.push(`Organization: ${organization.name}`);
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
        parts.push(`Organization Address: ${addressParts.join(", ")}`);
      }
    }
    if (organization.settings?.email) {
      parts.push(`Organization Email: ${organization.settings.email}`);
    }
    if (organization.settings?.phone) {
      parts.push(`Organization Phone: ${organization.settings.phone}`);
    }
    if (organization.settings?.defaultCurrency) {
      parts.push(`Default Currency: ${organization.settings.defaultCurrency}`);
    }
    
    // Proposal info
    parts.push(`\nProposal Title: ${proposal.title}`);
    if (proposal.description) {
      parts.push(`Proposal Description: ${proposal.description}`);
    }
    parts.push(`Proposal Currency: ${proposal.currency}`);
    parts.push(`Proposal Total: ${proposal.total} ${proposal.currency}`);
    parts.push(`Proposal Subtotal: ${proposal.subtotal} ${proposal.currency}`);
    if (proposal.taxTotal > 0) {
      parts.push(`Proposal Tax: ${proposal.taxTotal} ${proposal.currency}`);
    }
    if (proposal.terms) {
      parts.push(`Payment Terms: ${proposal.terms}`);
    }
    if (proposal.notes) {
      parts.push(`Notes: ${proposal.notes}`);
    }
    
    // Proposal items
    parts.push(`\nProposal Items (${proposal.items.length} items):`);
    proposal.items.forEach((item: ProposalItem, idx: number) => {
      parts.push(`${idx + 1}. ${item.description}`);
      parts.push(`   Quantity: ${item.qty}`);
      parts.push(`   Unit Price: ${item.unitPrice} ${proposal.currency}`);
      if (item.taxPct && item.taxPct > 0) {
        parts.push(`   Tax: ${item.taxPct}%`);
      }
      const itemTotal = item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100);
      parts.push(`   Total: ${itemTotal.toFixed(2)} ${proposal.currency}`);
    });
    
    // Lead/Client info
    if (lead?.data) {
      parts.push(`\nClient Information:`);
      if (lead.data.firstName || lead.data.lastName) {
        parts.push(`Name: ${[lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ")}`);
      }
      if (lead.data.company) {
        parts.push(`Company: ${lead.data.company}`);
      }
      if (lead.data.email) {
        parts.push(`Email: ${lead.data.email}`);
      }
      if (lead.data.phone) {
        parts.push(`Phone: ${lead.data.phone}`);
      }
      if (lead.data.message) {
        parts.push(`Message: ${lead.data.message}`);
      }
    }
    
    return parts.join("\n");
  }

  /**
   * Build AI prompt for conversion
   */
  private buildConversionPrompt(
    context: string,
    templateBindings: Set<string>,
    template: Template
  ): string {
    const bindingsList = Array.from(templateBindings).sort().join(", ");
    
    return `You are a professional invoice data converter. Convert the following proposal into invoice data that matches the specified template bindings.

Context:
${context}

Template Bindings Required:
${bindingsList}

CRITICAL MAPPING RULES:
1. Map proposal items to invoice items array:
   - proposal.items[].description → invoiceData.items[].description
   - proposal.items[].qty → invoiceData.items[].quantity (or invoiceData.items[].qty)
   - proposal.items[].unitPrice → invoiceData.items[].unitPrice (or invoiceData.items[].price)
   - Calculate invoiceData.items[].total = quantity * unitPrice (include tax if applicable)

2. Map customer/client information:
   - If template has "customer.name" or "buyer.name": Use lead name or company
   - If template has "customer.email" or "buyer.email": Use lead email
   - If template has "customer.address" or "buyer.address": Construct from lead data if available

3. Map seller/supplier information:
   - Use organization name, address, email, phone from context
   - Map to "seller.name", "supplier.name", "seller.address", etc. based on template bindings

4. Map financial totals:
   - proposal.subtotal → invoiceData.subtotal or invoiceData.netAmount
   - proposal.taxTotal → invoiceData.vatTotal or invoiceData.taxTotal
   - proposal.total → invoiceData.total or invoiceData.grossTotal

5. Map dates:
   - invoiceDate or issueDate: Use current date (YYYY-MM-DD format)
   - dueDate: Calculate based on payment terms or use 30 days from today

6. Map currency:
   - proposal.currency → invoiceData.currency

7. Generate invoice number:
   - Create a professional invoice number (e.g., "INV-2025-001" or "INV-{timestamp}")

8. Map payment terms and notes:
   - proposal.terms → invoiceData.terms or invoiceData.paymentTerms
   - proposal.notes → invoiceData.notes

IMPORTANT:
- Only include fields that exist in the template bindings
- Use the exact binding names from the template (e.g., if template uses "buyer.name", use that, not "customer.name")
- For nested objects (like seller.address), create the full object structure
- Ensure all numeric values are numbers, not strings
- Dates must be in YYYY-MM-DD format
- Currency code must match proposal currency

Generate a JSON object with:
- invoiceData: Object matching template bindings
- invoiceNumber: Generated invoice number (optional but recommended)

Respond with valid JSON only.`;
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
    
    // Ensure totals are correct
    const calculatedSubtotal = proposal.items.reduce((sum: number, item: ProposalItem) => sum + item.qty * item.unitPrice, 0);
    const calculatedTax = proposal.items.reduce(
      (sum: number, item: ProposalItem) => sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
      0
    );
    const calculatedTotal = calculatedSubtotal + calculatedTax;
    
    // Set totals (support multiple binding names)
    if (!invoiceData.subtotal && !invoiceData.netAmount) {
      invoiceData.subtotal = calculatedSubtotal;
    }
    if (!invoiceData.total && !invoiceData.grossTotal) {
      invoiceData.total = calculatedTotal;
    }
    if (calculatedTax > 0 && !invoiceData.vatTotal && !invoiceData.taxTotal) {
      invoiceData.vatTotal = calculatedTax;
    }
    
    // Ensure currency is set
    if (!invoiceData.currency) {
      invoiceData.currency = proposal.currency;
    }
    
    // Set dates if not present
    const today = new Date().toISOString().split("T")[0];
    if (!invoiceData.invoiceDate && !invoiceData.issueDate) {
      invoiceData.invoiceDate = today;
    }
    if (!invoiceData.dueDate) {
      // Calculate due date (30 days default, or from terms)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
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


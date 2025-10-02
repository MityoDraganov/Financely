# Dynamic Invoice System Guide

## Overview

The invoice system is designed to handle completely dynamic invoice structures based on templates. Each invoice references a template, and the invoice data structure adapts to match the template's element bindings.

## Architecture

### Key Concepts

1. **Templates**: Define the visual layout and data bindings for invoices
2. **Invoice Data**: Dynamic JSON structure that matches template bindings
3. **Bindings**: Dot-notation paths that connect template elements to data (e.g., `invoice.seller.name`)
4. **Tables**: Stored as arrays of objects within the invoice data

### Data Structure

```typescript
{
  orgId: string;              // Organization ID for multi-tenancy
  templateId: string;         // Reference to the template
  templateVersionId?: string; // Optional specific template version
  data: {                     // Dynamic data matching template bindings
    // Structure depends on template
    // Example for a standard invoice template:
    seller: { name: "...", address: "...", taxIdVat: "..." },
    buyer: { name: "...", address: "...", taxIdVat: "..." },
    invoiceNumber: "INV-001",
    issueDate: "2025-01-01",
    dueDate: "2025-01-31",
    items: [                  // Tables as arrays
      { description: "Item 1", qty: 1, unitPrice: 100, total: 100 },
      { description: "Item 2", qty: 2, unitPrice: 50, total: 100 }
    ],
    subtotal: 200,
    vatTotal: 40,
    total: 240,
    // ... any other fields from template
  },
  status: "draft" | "sent" | "paid" | "cancelled",
  notes?: string,
  pdfUrl?: string
}
```

## Template Bindings

Templates contain elements with bindings that reference invoice data:

### Text Elements
```typescript
{
  type: "text",
  text: "Invoice #",
  binding: "invoice.invoiceNumber"  // References data.invoiceNumber
}
```

### Table Elements
```typescript
{
  type: "table",
  itemsBinding: "invoice.items",    // References data.items array
  columns: [
    {
      id: "col1",
      header: "Description",
      binding: "description",         // References item.description
    },
    {
      id: "col2",
      header: "Quantity",
      binding: "qty",                 // References item.qty
    }
  ]
}
```

### Input Elements
```typescript
{
  type: "input",
  binding: "invoice.customField",   // References data.customField
  variant: "text"
}
```

## Usage Examples

### Example 1: Standard Invoice

**Template Bindings:**
- `invoice.seller.name`, `invoice.seller.address`, `invoice.seller.taxIdVat`
- `invoice.buyer.name`, `invoice.buyer.address`, `invoice.buyer.taxIdVat`
- `invoice.invoiceNumber`, `invoice.issueDate`, `invoice.dueDate`
- `invoice.items` (table with columns: description, qty, unitPrice, total)
- `invoice.subtotal`, `invoice.vatTotal`, `invoice.total`

**Creating the Invoice:**

```typescript
// Frontend (React)
import { functionsService } from "@/services";

const createStandardInvoice = async () => {
  const result = await functionsService.createInvoice({
    orgId: "org_123",
    templateId: "template_standard_invoice",
    data: {
      seller: {
        name: "Acme Corporation",
        address: "123 Main Street, Suite 100\nNew York, NY 10001",
        taxIdVat: "US-123456789"
      },
      buyer: {
        name: "Customer Ltd",
        address: "456 Oak Avenue\nBoston, MA 02101",
        taxIdVat: "US-987654321"
      },
      invoiceNumber: "INV-2025-001",
      issueDate: "2025-01-01",
      dueDate: "2025-01-31",
      items: [
        {
          description: "Consulting Services - January 2025",
          qty: 10,
          unitPrice: 150,
          total: 1500
        },
        {
          description: "Software Development",
          qty: 20,
          unitPrice: 175,
          total: 3500
        }
      ],
      subtotal: 5000,
      vatTotal: 1000,
      total: 6000
    },
    status: "draft"
  });
  
  console.log("Invoice created:", result.id);
};
```

### Example 2: Custom Service Invoice

**Template Bindings:**
- `invoice.provider.name`, `invoice.provider.contact`
- `invoice.client.name`, `invoice.client.email`
- `invoice.projectName`, `invoice.projectId`
- `invoice.services` (table with columns: service, hours, rate, amount)
- `invoice.totalAmount`

**Creating the Invoice:**

```typescript
const createServiceInvoice = async () => {
  const result = await functionsService.createInvoice({
    orgId: "org_123",
    templateId: "template_service_invoice",
    data: {
      provider: {
        name: "Freelancer Inc",
        contact: "freelancer@example.com"
      },
      client: {
        name: "Tech Startup",
        email: "billing@techstartup.com"
      },
      projectName: "Website Redesign",
      projectId: "PRJ-2025-042",
      services: [
        {
          service: "UI/UX Design",
          hours: 40,
          rate: 100,
          amount: 4000
        },
        {
          service: "Frontend Development",
          hours: 80,
          rate: 120,
          amount: 9600
        }
      ],
      totalAmount: 13600
    },
    status: "draft"
  });
  
  console.log("Service invoice created:", result.id);
};
```

### Example 3: Product Sales Invoice

**Template Bindings:**
- `invoice.company.logo`, `invoice.company.name`
- `invoice.customer.name`, `invoice.customer.address`
- `invoice.orderNumber`, `invoice.orderDate`
- `invoice.products` (table with columns: sku, name, qty, price, discount, total)
- `invoice.shipping`, `invoice.tax`, `invoice.grandTotal`

**Creating the Invoice:**

```typescript
const createProductInvoice = async () => {
  const result = await functionsService.createInvoice({
    orgId: "org_123",
    templateId: "template_product_invoice",
    data: {
      company: {
        logo: "https://example.com/logo.png",
        name: "Electronics Store"
      },
      customer: {
        name: "John Doe",
        address: "789 Elm Street\nSan Francisco, CA 94102"
      },
      orderNumber: "ORD-2025-1234",
      orderDate: "2025-01-15",
      products: [
        {
          sku: "LAPTOP-001",
          name: "Professional Laptop",
          qty: 1,
          price: 1200,
          discount: 50,
          total: 1150
        },
        {
          sku: "MOUSE-042",
          name: "Wireless Mouse",
          qty: 2,
          price: 30,
          discount: 0,
          total: 60
        }
      ],
      shipping: 20,
      tax: 184,
      grandTotal: 1414
    },
    status: "draft"
  });
  
  console.log("Product invoice created:", result.id);
};
```

## Helper Functions

The invoice entity provides helper functions for working with dynamic data:

### `validateInvoiceBindings`

Validate that required template bindings exist in invoice data:

```typescript
import { validateInvoiceBindings } from "@/core/entities/invoice";

const requiredBindings = [
  "seller.name",
  "seller.address",
  "invoiceNumber",
  "items"
];

const result = validateInvoiceBindings(invoiceData.data, requiredBindings);

if (!result.valid) {
  console.error("Missing required fields:", result.missing);
}
```

### `getBindingValue`

Get a value from invoice data using a binding path:

```typescript
import { getBindingValue } from "@/core/entities/invoice";

const sellerName = getBindingValue(invoiceData.data, "seller.name");
const items = getBindingValue(invoiceData.data, "items");
```

### `setBindingValue`

Set a value in invoice data using a binding path:

```typescript
import { setBindingValue } from "@/core/entities/invoice";

const data = {};
setBindingValue(data, "seller.name", "Acme Corp");
setBindingValue(data, "seller.address", "123 Main St");

// Result: { seller: { name: "Acme Corp", address: "123 Main St" } }
```

## Database Storage

Invoices are stored in the `invoices` Firestore collection with the following structure:

```
invoices/
  {invoiceId}/
    id: string
    createdAt: timestamp
    updatedAt: timestamp
    orgId: string
    templateId: string
    templateVersionId?: string
    data: {
      // Dynamic structure based on template
    }
    status: "draft" | "sent" | "paid" | "cancelled"
    notes?: string
    pdfUrl?: string
```

### Tables in Database

Tables are stored as arrays within the `data` field:

```json
{
  "id": "invoice_123",
  "orgId": "org_456",
  "templateId": "template_789",
  "data": {
    "seller": { "name": "Acme", "address": "..." },
    "buyer": { "name": "Customer", "address": "..." },
    "items": [
      { "description": "Item 1", "qty": 1, "unitPrice": 100 },
      { "description": "Item 2", "qty": 2, "unitPrice": 50 }
    ]
  },
  "status": "draft"
}
```

## Best Practices

1. **Template Validation**: Always validate that invoice data matches the template's bindings before creation
2. **Type Safety**: Use TypeScript's `InvoiceDataValue` type for working with dynamic data
3. **Table Consistency**: Ensure all items in a table array have the same structure
4. **Calculated Fields**: Store calculated values (subtotals, totals) in the data rather than calculating on-the-fly
5. **Status Management**: Use the status field to track invoice lifecycle
6. **Version Control**: Reference specific template versions for long-term consistency

## API Reference

### Firebase Function: `createInvoice`

**Endpoint:** `createInvoice`

**Parameters:**
```typescript
{
  orgId: string;
  templateId: string;
  templateVersionId?: string;
  data: Record<string, InvoiceDataValue>;
  status?: "draft" | "sent" | "paid" | "cancelled";
  notes?: string;
}
```

**Returns:**
```typescript
{
  id: string; // The created invoice ID
}
```

**Example:**
```typescript
const result = await httpsCallable(functions, 'createInvoice')({
  orgId: "org_123",
  templateId: "template_456",
  data: { /* ... */ }
});

console.log("Invoice ID:", result.data.id);
```

## Error Handling

The system provides detailed error messages for common issues:

```typescript
try {
  await functionsService.createInvoice({
    orgId: "org_123",
    templateId: "template_456",
    data: { /* ... */ }
  });
} catch (error) {
  if (error.code === "invalid-argument") {
    console.error("Validation failed:", error.message);
  } else if (error.code === "internal") {
    console.error("Server error:", error.message);
  } else {
    console.error("Unknown error:", error);
  }
}
```

## Future Enhancements

- Template binding validation before invoice creation
- Automatic calculation of totals based on template formulas
- Invoice versioning and history
- Multi-currency support
- PDF generation with template rendering
- Email delivery integration


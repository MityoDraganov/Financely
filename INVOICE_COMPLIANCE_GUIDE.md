# Invoice Compliance System Guide

## Overview

The Invoice Compliance System ensures that invoice templates and generated invoices meet legal requirements for different regions (USA, EU, Canada, Australia, UK) while maintaining full creative freedom for layout, branding, and styling.

## Architecture

### Core Components

1. **Compliance Schema Layer** (`core/entities/invoice-compliance.ts`)
   - Defines required fields per region using Zod schemas
   - Provides metadata about field requirements
   - Includes auto-footer text and legal clauses

2. **Template Compliance Metadata** (`core/entities/template.ts`)
   - Extends templates with compliance metadata
   - Tracks required fields, region, and validation status

3. **Compliance Validation Service** (`services/invoice-compliance-service.ts`)
   - Validates invoices against regional requirements
   - Detects compliance region from organization/customer data
   - Generates compliance footers

4. **Compliance Utilities** (`utils/invoice-compliance.ts`)
   - Region detection from country codes
   - Template binding validation
   - Auto-footer generation

## Key Features

### ✅ Full Creative Freedom
- Users can design any layout, use any colors, fonts, and styling
- Mandatory fields can be repositioned and styled freely
- Custom sections and branding are fully supported

### ✅ Automatic Compliance Validation
- Validates invoice data before rendering or export
- Checks template bindings against required fields
- Provides clear error messages for missing fields

### ✅ Regional Adaptation
- Automatically detects region from organization/customer country
- Applies appropriate compliance schema (US, EU, CA, AU, UK)
- Uses stricter schema (EU) for cross-border transactions

### ✅ Auto-Generated Legal Footers
- Automatically inserts region-specific compliance text
- Includes conditional clauses (e.g., reverse charge notes)
- Can be customized or disabled per template

## Compliance Requirements by Region

### 🇺🇸 United States (US)

**Required Fields:**
- Invoice number
- Invoice date
- Seller business name and address
- Customer name
- At least one line item
- Total amount

**Optional Fields:**
- Seller Tax ID (EIN)
- Due date
- Tax rate and amount

**Auto-Footer:**
"Amounts include applicable state sales tax where required."

### 🇪🇺 European Union (EU)

**Required Fields:**
- Invoice number (legally mandatory)
- Invoice date (legally mandatory)
- Supplier name, address, and VAT ID
- Customer name and address
- At least one line item with VAT rate and amount
- Net amount, VAT total, and gross total
- Currency (ISO code)

**Optional Fields:**
- Customer VAT ID
- Supply date (if different from invoice date)
- Due date

**Auto-Footer:**
"This invoice complies with EU Council Directive 2006/112/EC on VAT."

**Special Cases:**
- Reverse charge: Automatically adds "Reverse charge — VAT to be accounted for by the recipient."
- VAT must be shown per line item
- Totals must match: `grossTotal = netAmount + vatTotal`

### 🇨🇦 Canada (CA)

**Required Fields:**
- Invoice number
- Invoice date
- Seller business name
- Customer name
- At least one line item
- Total amount

**Auto-Footer:**
"Amounts include applicable GST/HST where required."

### 🇦🇺 Australia (AU)

**Required Fields:**
- Invoice number
- Invoice date
- Seller business name
- Customer name
- At least one line item
- Total amount

**Auto-Footer:**
"Amounts include applicable GST where required."

### 🇬🇧 United Kingdom (UK)

**Required Fields:**
- Invoice number
- Invoice date
- Supplier name and VAT ID
- Customer name
- At least one line item
- Net amount, VAT total, and gross total

**Auto-Footer:**
"This invoice complies with UK VAT regulations."

## Usage Examples

### 1. Detecting Compliance Region

```typescript
import { invoiceComplianceService } from "@/services";

// Detect region from organization
const region = invoiceComplianceService.detectRegion(organization, customerCountry);

// Or use utility directly
import { detectRegionForInvoice } from "@/utils/invoice-compliance";
const region = detectRegionForInvoice("US", "GB"); // Returns "EU" for cross-border
```

### 2. Validating Invoice Data

```typescript
import { invoiceComplianceService } from "@/services";

const invoiceData: InvoiceData = {
  orgId: "org_123",
  templateId: "template_456",
  data: {
    invoiceNumber: "INV-001",
    invoiceDate: "2025-01-15",
    seller: {
      name: "Acme Corp",
      address: { street: "123 Main St", city: "New York", country: "US" },
    },
    customer: {
      name: "Customer Ltd",
      address: { street: "456 Oak Ave", city: "London", country: "GB" },
    },
    items: [
      { description: "Service", quantity: 1, unitPrice: 100, total: 100 },
    ],
    total: 100,
  },
  status: "draft",
};

const region = invoiceComplianceService.detectRegion(organization);
const validation = invoiceComplianceService.validateInvoice(invoiceData, region);

if (!validation.valid) {
  console.error("Missing fields:", validation.missingFields);
  // Output: [{ binding: "seller.vatId", label: "Supplier VAT ID", ... }]
}
```

### 3. Validating Template Compliance

```typescript
import { invoiceComplianceService } from "@/services";

const template: Template = {
  // ... template data
  elements: [
    { type: "text", binding: "invoiceNumber", ... },
    { type: "text", binding: "seller.name", ... },
    // ... other elements
  ],
};

const region = invoiceComplianceService.detectRegion(organization);
const validation = invoiceComplianceService.validateTemplate(template, region);

if (!validation.valid) {
  console.error("Missing bindings:", validation.missingBindings);
  // Output: ["seller.vatId", "vatTotal", "grossTotal"]
}
```

### 4. Generating Compliance Footer

```typescript
import { invoiceComplianceService } from "@/services";

const region = invoiceComplianceService.detectRegion(organization);
const footer = invoiceComplianceService.generateFooter(region, invoiceData.data);

// For EU with reverse charge:
// "This invoice complies with EU Council Directive 2006/112/EC on VAT. Reverse charge — VAT to be accounted for by the recipient."
```

### 5. Checking Required Fields

```typescript
import { invoiceComplianceService } from "@/services";

const region = invoiceComplianceService.detectRegion(organization);
const requiredFields = invoiceComplianceService.getRequiredFields(region);

// For EU: ["invoiceNumber", "invoiceDate", "supplier.name", "supplier.vatId", ...]
```

## Template Metadata

Templates can include compliance metadata:

```typescript
const template: Template = {
  // ... other fields
  compliance: {
    region: "EU",
    requiredFields: ["invoiceNumber", "supplier.vatId", "vatTotal"],
    autoFooter: true,
    customFooter: "Custom legal text", // Optional, overrides auto-footer
    complianceValidated: true,
    complianceValidatedAt: "2025-01-15T10:00:00Z",
  },
};
```

## Integration Points

### In the Template Designer

1. **Visual Indicators**: Show lock icons on mandatory fields
2. **Real-time Validation**: Validate template as user designs
3. **Compliance Status**: Display ✅ compliant / ⚠️ missing required field
4. **Prevent Publishing**: Block publishing non-compliant templates

### In Invoice Creation

1. **Pre-validation**: Check compliance before saving
2. **Auto-fill**: Suggest default values from organization data
3. **Warnings**: Show warnings for missing optional but recommended fields
4. **Block Sending**: Prevent sending non-compliant invoices

### In Invoice Rendering

1. **Auto-footer Injection**: Automatically add compliance footer if enabled
2. **Conditional Clauses**: Add reverse charge notes when applicable
3. **Format Validation**: Ensure currency, dates, and numbers are properly formatted

## Region Detection Logic

1. **Primary**: Use organization's explicit `region` setting if set
2. **Secondary**: Detect from organization's `country` code
3. **Cross-border**: If customer country differs, apply stricter schema (EU if either party is EU)
4. **Default**: Fall back to "US" if no country/region specified

## Extending the System

### Adding a New Region

1. Add region to `InvoiceRegion` enum in `invoice-compliance.ts`
2. Define compliance schema in `COMPLIANCE_SCHEMAS`
3. Add country mappings in `COUNTRY_TO_REGION_MAP` in `utils/invoice-compliance.ts`
4. Update Zod schemas if needed

### Custom Validation Rules

Extend `validateInvoiceCompliance` in `utils/invoice-compliance.ts` to add region-specific validation logic.

## Best Practices

1. **Always Validate Before Publishing**: Check template compliance before allowing template publication
2. **Validate Before Sending**: Check invoice compliance before sending to customers
3. **Show Clear Errors**: Display user-friendly error messages with field labels
4. **Auto-fill When Possible**: Pre-fill organization data (name, address, VAT ID) automatically
5. **Preserve User Freedom**: Allow styling and positioning of mandatory fields
6. **Document Requirements**: Show help text explaining why fields are required

## Error Handling

The validation system provides detailed error information:

```typescript
interface ComplianceValidationResult {
  valid: boolean;
  region: InvoiceRegion;
  missingFields: Array<{
    binding: string;
    label: string;
    description?: string;
  }>;
  warnings?: string[]; // Non-blocking issues
  errors?: string[]; // Blocking issues (e.g., totals don't match)
}
```

## Future Enhancements

- [ ] Multi-region invoice support (single invoice for multiple regions)
- [ ] E-invoicing format support (XML/UBL for EU)
- [ ] Digital signature integration
- [ ] Archival metadata (10-year retention for EU)
- [ ] Currency conversion display for non-EUR EU invoices
- [ ] State-specific US tax rules
- [ ] Real-time compliance checking in template designer

## Related Files

- `app/src/core/entities/invoice-compliance.ts` - Compliance schemas and types
- `app/src/core/entities/template.ts` - Template compliance metadata
- `app/src/core/entities/organization.ts` - Organization country/region fields
- `app/src/utils/invoice-compliance.ts` - Compliance utilities
- `app/src/services/invoice-compliance-service.ts` - Compliance service layer
- `functions/src/...` - Backend equivalents


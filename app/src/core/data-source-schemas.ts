export interface SchemaField {
  path: string;
  type: "string" | "number" | "boolean" | "date" | "currency" | "object" | "array";
  description?: string;
  children?: SchemaField[];
}

export interface DataSourceSchema {
  key: string;
  label: string;
  description: string;
  requiredParams: string[];
  fields: SchemaField[];
  usedBy: string[];
}

export const dataSourceSchemas: DataSourceSchema[] = [
  {
    key: "invoice",
    label: "Invoice",
    description: "Invoice with items and totals",
    requiredParams: ["invoiceId"],
    usedBy: ["Email Templates", "Invoice Templates", "Workflows"],
    fields: [
      { path: "invoice.id", type: "string", description: "Invoice ID" },
      { path: "invoice.number", type: "string", description: "Invoice number" },
      { path: "invoice.status", type: "string", description: "Invoice status (draft, sent, paid, cancelled)" },
      { path: "invoice.issueDate", type: "date", description: "Invoice issue date" },
      { path: "invoice.dueDate", type: "date", description: "Invoice due date" },
      { path: "invoice.data", type: "object", description: "Dynamic invoice data (structure depends on template)" },
      {
        path: "invoice.data.items",
        type: "array",
        description: "Invoice line items",
        children: [
          { path: "invoice.data.items[*].description", type: "string" },
          { path: "invoice.data.items[*].quantity", type: "number" },
          { path: "invoice.data.items[*].unitPrice", type: "currency" },
          { path: "invoice.data.items[*].total", type: "currency" },
        ],
      },
    ],
  },
  {
    key: "customer",
    label: "Customer",
    description: "Customer profile data",
    requiredParams: ["customerId"],
    usedBy: ["Email Templates", "Workflows"],
    fields: [
      { path: "customer.id", type: "string", description: "Customer ID" },
      { path: "customer.firstName", type: "string", description: "Customer first name" },
      { path: "customer.lastName", type: "string", description: "Customer last name" },
      { path: "customer.email", type: "string", description: "Customer email address" },
      { path: "customer.phone", type: "string", description: "Customer phone number" },
      { path: "customer.company", type: "string", description: "Customer company name" },
      { path: "customer.jobTitle", type: "string", description: "Customer job title" },
      {
        path: "customer.address",
        type: "object",
        description: "Customer address",
        children: [
          { path: "customer.address.street", type: "string" },
          { path: "customer.address.city", type: "string" },
          { path: "customer.address.state", type: "string" },
          { path: "customer.address.zipCode", type: "string" },
          { path: "customer.address.country", type: "string" },
        ],
      },
      { path: "customer.status", type: "string", description: "Customer status" },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    description: "Organization settings and branding",
    requiredParams: ["organizationId"],
    usedBy: ["Email Templates", "Invoice Templates", "Workflows", "Widgets"],
    fields: [
      { path: "organization.id", type: "string", description: "Organization ID" },
      { path: "organization.name", type: "string", description: "Organization name" },
      { path: "organization.description", type: "string", description: "Organization description" },
      { path: "organization.logoUrl", type: "string", description: "Organization logo URL" },
      { path: "organization.website", type: "string", description: "Organization website URL" },
      {
        path: "organization.settings",
        type: "object",
        description: "Organization settings",
        children: [
          { path: "organization.settings.defaultCurrency", type: "string" },
          { path: "organization.settings.defaultLanguage", type: "string" },
          { path: "organization.settings.defaultTimezone", type: "string" },
          { path: "organization.settings.country", type: "string" },
          { path: "organization.settings.region", type: "string" },
          {
            path: "organization.settings.brandColors",
            type: "object",
            children: [
              { path: "organization.settings.brandColors.primary", type: "string" },
              { path: "organization.settings.brandColors.secondary", type: "string" },
              { path: "organization.settings.brandColors.accent", type: "string" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "payment",
    label: "Payment",
    description: "Payment information from invoice",
    requiredParams: ["invoiceId"],
    usedBy: ["Email Templates", "Workflows"],
    fields: [
      { path: "payment.id", type: "string", description: "Payment ID" },
      { path: "payment.amount", type: "currency", description: "Payment amount" },
      { path: "payment.currency", type: "string", description: "Payment currency" },
      { path: "payment.status", type: "string", description: "Payment status" },
      { path: "payment.method", type: "string", description: "Payment method" },
      { path: "payment.transactionId", type: "string", description: "Transaction ID" },
      { path: "payment.paidAt", type: "date", description: "Payment date" },
      { path: "payment.invoiceId", type: "string", description: "Associated invoice ID" },
    ],
  },
  {
    key: "usage",
    label: "Usage",
    description: "Organization usage statistics",
    requiredParams: ["organizationId"],
    usedBy: ["Workflows"],
    fields: [
      { path: "usage.invoiceCount", type: "number", description: "Total number of invoices" },
      { path: "usage.emailCount", type: "number", description: "Total number of emails sent" },
      { path: "usage.storageUsed", type: "number", description: "Storage used in bytes" },
      { path: "usage.lastActivity", type: "date", description: "Last activity timestamp" },
    ],
  },
  {
    key: "computed",
    label: "Computed Fields",
    description: "Calculated values derived from other data sources",
    requiredParams: [],
    usedBy: ["Email Templates", "Invoice Templates", "Workflows"],
    fields: [
      { path: "computed.invoiceSubtotal", type: "currency", description: "Sum of all invoice line item totals" },
      { path: "computed.invoiceTax", type: "currency", description: "Total tax/VAT amount" },
      { path: "computed.invoiceTotal", type: "currency", description: "Grand total (subtotal + tax)" },
      { path: "computed.invoiceItemCount", type: "number", description: "Number of items in invoice" },
      { path: "computed.customerFullName", type: "string", description: "Customer full name (firstName + lastName)" },
    ],
  },
];

export function getDataSourceSchema(key: string): DataSourceSchema | undefined {
  return dataSourceSchemas.find((schema) => schema.key === key);
}

export function getAllDataSourceSchemas(): DataSourceSchema[] {
  return dataSourceSchemas;
}

export function getFieldsForDataSource(key: string): SchemaField[] {
  const schema = getDataSourceSchema(key);
  return schema?.fields || [];
}

export function flattenSchemaFields(fields: SchemaField[], prefix = ""): SchemaField[] {
  const result: SchemaField[] = [];
  for (const field of fields) {
    const fullPath = prefix ? `${prefix}.${field.path}` : field.path;
    result.push({ ...field, path: fullPath });
    if (field.children) {
      result.push(...flattenSchemaFields(field.children, fullPath));
    }
  }
  return result;
}

export function createExternalSourceSchema(
  name: string,
  fields: Record<string, unknown>
): DataSourceSchema {
  const schemaFields: SchemaField[] = [];

  function processObject(obj: Record<string, unknown>, path: string = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      
      if (value === null || value === undefined) {
        schemaFields.push({
          path: fieldPath,
          type: "string",
          description: `${key} field`,
        });
      } else if (typeof value === "string") {
        schemaFields.push({
          path: fieldPath,
          type: "string",
          description: `${key} field`,
        });
      } else if (typeof value === "number") {
        schemaFields.push({
          path: fieldPath,
          type: "number",
          description: `${key} field`,
        });
      } else if (typeof value === "boolean") {
        schemaFields.push({
          path: fieldPath,
          type: "boolean",
          description: `${key} field`,
        });
      } else if (Array.isArray(value)) {
        schemaFields.push({
          path: fieldPath,
          type: "array",
          description: `${key} array`,
        });
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
          processObject(value[0] as Record<string, unknown>, `${fieldPath}[*]`);
        }
      } else if (typeof value === "object") {
        schemaFields.push({
          path: fieldPath,
          type: "object",
          description: `${key} object`,
          children: [],
        });
        processObject(value as Record<string, unknown>, fieldPath);
      }
    }
  }

  processObject(fields, `external.${name}`);

  return {
    key: `external:${name}`,
    label: name,
    description: `External data source: ${name}`,
    requiredParams: [],
    usedBy: ["Email Templates", "Invoice Templates", "Workflows", "Widgets"],
    fields: schemaFields,
  };
}

export function getExternalSourceSchema(
  name: string,
  sampleData?: Record<string, unknown>
): DataSourceSchema | undefined {
  if (!sampleData) {
    return {
      key: `external:${name}`,
      label: name,
      description: `External data source: ${name}`,
      requiredParams: [],
      usedBy: ["Email Templates", "Invoice Templates", "Workflows", "Widgets"],
      fields: [],
    };
  }
  return createExternalSourceSchema(name, sampleData);
}


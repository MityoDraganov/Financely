# Data Sources System

## Overview

The Data Sources system provides a unified, read-only data access layer for templates, workflows, and widgets. All data resolution happens server-side before rendering, ensuring templates never fetch data themselves.

## Architecture

```
Template/Workflow Request
    ↓
Context Builder
    ↓
Data Source Registry
    ↓
    ├─ Internal Sources → Repositories → Firestore/RTDB
    └─ External Sources → Connectors → External APIs
    ↓
Computed Fields Pipeline
    ↓
DataContext (read-only)
    ↓
Template Renderer / Workflow Engine / Widget Renderer
```

## Core Concepts

### DataContext

The `DataContext` is a read-only object that contains all resolved data sources. It has the following structure:

```typescript
{
  invoice?: InvoiceContext
  customer?: CustomerContext
  organization?: OrganizationContext
  payment?: PaymentContext
  usage?: UsageContext
  external?: Record<string, Record<string, any>>  // External source data
  computed?: Record<string, any>
  meta?: {
    locale: string
    currency: string
    timezone: string
  }
}
```

### Data Source Registry

The registry defines available data sources and how they are resolved. Each source has:

- `key`: Unique identifier (e.g., "invoice", "customer")
- `description`: Human-readable description
- `requiredParams`: Parameters needed to resolve the source (e.g., ["invoiceId"])
- `resolve`: Function that fetches and maps data to a template-safe shape

### Context Builder

The `buildDataContext` function:

1. Accepts a list of required sources and IDs
2. Resolves sources sequentially
3. Allows later sources to depend on earlier ones
4. Computes derived values
5. Returns a frozen `DataContext`

## Available Data Sources

### Invoice

**Key**: `invoice`

**Required Parameters**: `invoiceId`

**Available Fields**:
- `invoice.id` - Invoice ID
- `invoice.number` - Invoice number
- `invoice.status` - Status (draft, sent, paid, cancelled)
- `invoice.issueDate` - Issue date
- `invoice.dueDate` - Due date
- `invoice.data.*` - Dynamic invoice data (structure depends on template)
- `invoice.data.items[*]` - Invoice line items array

**Used By**: Email Templates, Invoice Templates, Workflows

### Customer

**Key**: `customer`

**Required Parameters**: `customerId`

**Available Fields**:
- `customer.id` - Customer ID
- `customer.firstName` - First name
- `customer.lastName` - Last name
- `customer.email` - Email address
- `customer.phone` - Phone number
- `customer.company` - Company name
- `customer.jobTitle` - Job title
- `customer.address.*` - Address object (street, city, state, zipCode, country)
- `customer.status` - Customer status

**Used By**: Email Templates, Workflows

### Organization

**Key**: `organization`

**Required Parameters**: `organizationId`

**Available Fields**:
- `organization.id` - Organization ID
- `organization.name` - Organization name
- `organization.description` - Description
- `organization.logoUrl` - Logo URL
- `organization.website` - Website URL
- `organization.settings.*` - Settings object (defaultCurrency, defaultLanguage, brandColors, etc.)

**Used By**: Email Templates, Invoice Templates, Workflows, Widgets

### Payment

**Key**: `payment`

**Required Parameters**: `invoiceId`

**Available Fields**:
- `payment.id` - Payment ID
- `payment.amount` - Payment amount
- `payment.currency` - Currency code
- `payment.status` - Payment status
- `payment.method` - Payment method
- `payment.transactionId` - Transaction ID
- `payment.paidAt` - Payment date
- `payment.invoiceId` - Associated invoice ID

**Used By**: Email Templates, Workflows

### Usage

**Key**: `usage`

**Required Parameters**: `organizationId`

**Available Fields**:
- `usage.invoiceCount` - Total number of invoices
- `usage.emailCount` - Total emails sent
- `usage.storageUsed` - Storage used in bytes
- `usage.lastActivity` - Last activity timestamp

**Used By**: Workflows

### Computed Fields

**Key**: `computed`

**Required Parameters**: None (automatically computed)

**Available Fields**:
- `computed.invoiceSubtotal` - Sum of all invoice line item totals
- `computed.invoiceTax` - Total tax/VAT amount
- `computed.invoiceTotal` - Grand total (subtotal + tax)
- `computed.invoiceItemCount` - Number of items in invoice
- `computed.customerFullName` - Customer full name (firstName + lastName)

**Used By**: Email Templates, Invoice Templates, Workflows

## Binding Path Syntax

Binding paths use dot notation to access nested values:

- `invoice.number` - Access invoice number
- `customer.address.city` - Access nested object property
- `invoice.data.items[0].total` - Access array element by index
- `invoice.data.items[*]` - Access entire array (for iteration)
- `computed.invoiceTotal` - Access computed field

### Array Access

- `items[0]` - First item
- `items[1]` - Second item
- `items[*]` - All items (for iteration in templates)

## Usage Examples

### Building DataContext

```typescript
import { buildDataContext } from "./services/data-context-builder";
import { getDatabaseService } from "./services/database-service";

const context = await buildDataContext(
  {
    include: ["invoice", "customer", "organization"],
    invoiceId: "inv_123",
    customerId: "cust_456",
    organizationId: "org_789",
  },
  databaseService
);
```

### Resolving Bindings

```typescript
import { resolveBinding } from "./utils/binding-resolver";

const invoiceNumber = resolveBinding(context, "invoice.number");
const customerName = resolveBinding(context, "customer.firstName");
const total = resolveBinding(context, "computed.invoiceTotal");
```

### Using in Email Templates

```typescript
import { processEmailTemplateFromContext } from "./utils/email-template-processor";

const processed = processEmailTemplateFromContext(
  {
    html: "<h1>Invoice {{invoiceNumber}}</h1>",
    subject: "Invoice {{invoiceNumber}}",
  },
  {
    invoiceNumber: "invoice.number",
    customerName: "customer.firstName",
  },
  context
);
```

### Using in Workflows

Workflows automatically build DataContext when triggered. Conditions can reference any binding path:

```json
{
  "field": "invoice.status",
  "operator": "equals",
  "value": "paid"
}
```

Or computed fields:

```json
{
  "field": "computed.invoiceTotal",
  "operator": "greater_than",
  "value": 1000
}
```

## Adding New Data Sources

### 1. Create Source Resolver

Create a resolver function in `functions/src/services/data-sources/`:

```typescript
import { ResolverContext } from "../data-source-registry";
import { YourContext } from "../../core/entities/data-context";

export async function resolveYourSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ yourSource?: YourContext }> {
  const id = params.yourId;
  if (!id) return {};

  // Fetch from repository
  const repository = getYourRepository(ctx.databaseService);
  const entity = await repository.get({ id });

  if (!entity) return {};

  // Map to template-safe shape
  return {
    yourSource: mapEntityToContext(entity),
  };
}
```

### 2. Register in Context Builder

Add to `initializeDataSources()` in `data-context-builder.ts`:

```typescript
dataSourceRegistry.register({
  key: "yourSource",
  description: "Your data source description",
  requiredParams: ["yourId"],
  resolve: resolveYourSource,
});
```

### 3. Add to DataContext Type

Update `functions/src/core/entities/data-context.ts`:

```typescript
export const yourContextSchema = z.object({
  // ... fields
});

export type YourContext = z.infer<typeof yourContextSchema>;

export const dataContextSchema = z.object({
  // ... existing sources
  yourSource: yourContextSchema.optional(),
});
```

### 4. Add Frontend Schema

Update `app/src/core/data-source-schemas.ts`:

```typescript
{
  key: "yourSource",
  label: "Your Source",
  description: "Description",
  requiredParams: ["yourId"],
  usedBy: ["Email Templates", "Workflows"],
  fields: [
    { path: "yourSource.field1", type: "string", description: "..." },
    // ...
  ],
}
```

## Computed Fields

Computed fields are automatically calculated after source resolution. To add a new computed field:

```typescript
import { computedFieldsService } from "./computed-fields-service";

computedFieldsService.register({
  key: "yourComputedField",
  compute: (context) => {
    // Calculate value from context
    return computedValue;
  },
});
```

## Best Practices

1. **Never fetch data in templates** - All data must come from DataContext
2. **Use computed fields for calculations** - Don't calculate in templates
3. **Keep source resolvers simple** - Map entities to clean, serializable objects
4. **Validate required parameters** - Fail fast if required params are missing
5. **Handle missing data gracefully** - Return undefined for optional sources
6. **Use consistent binding paths** - Same syntax everywhere (emails, invoices, workflows)

## Security

- DataContext is read-only (frozen)
- Source resolvers validate organization ownership
- No direct Firestore access from templates
- All data is sanitized before being added to context

## Performance

- Sources are resolved sequentially (can be parallelized in future)
- Computed fields are cached in context
- Binding resolution is O(n) where n is path depth
- Missing bindings return null immediately (no expensive lookups)

## External Data Sources

External data sources allow you to integrate third-party APIs and services into your templates, workflows, and widgets. All external data is resolved server-side before rendering, ensuring predictable performance and security.

### Supported Source Types

- **REST API**: Standard REST endpoints with GET/POST/PUT/DELETE support
- **GraphQL**: GraphQL APIs with query execution
- **Webhook**: Event-driven data from webhook payloads

### How External Sources Work

1. **Configuration**: External sources are configured in Settings → External Sources
2. **Resolution**: When a template/workflow requests an external source, it's resolved via the appropriate connector
3. **Caching**: External data is cached with configurable TTL to reduce API calls
4. **Normalization**: External data is mapped to a consistent internal schema
5. **Access**: External data appears in DataContext as `external.sourceName.fieldName`

### Refresh Strategies

- **On-Demand**: Data is fetched when needed (with caching)
- **Scheduled**: Data is refreshed on a schedule (e.g., every hour)
- **Event-Driven**: Data is updated via webhook payloads

### Using External Sources

Include external sources in the `buildDataContext` include list:

```typescript
const context = await buildDataContext(
  {
    include: ["invoice", "external:myApiSource"],
    invoiceId: "inv_123",
    organizationId: "org_789",
  },
  databaseService
);
```

Access external data using binding paths:

```typescript
// In templates
const apiData = resolveBinding(context, "external.myApiSource.fieldName");
```

### Adding External Sources

1. Go to Settings → External Sources
2. Click "Add External Source"
3. Select source type (REST API, GraphQL, Webhook)
4. Configure endpoint and authentication
5. Test connection
6. Map external schema to internal schema
7. Configure refresh strategy
8. Save configuration

### Security

- Credentials are encrypted at rest
- API keys are never exposed to templates
- Organization isolation enforced
- Rate limiting per source
- OAuth token refresh handled automatically

### Caching

External data is cached with configurable TTL:
- Default TTL: 300 seconds (5 minutes)
- Cache invalidation: Time-based or event-based
- Cache storage: In-memory + Firestore for persistence

### Monitoring

External sources are monitored for:
- Health status (active, error, inactive)
- Last sync timestamp
- Error logs (last 10 errors)
- Performance metrics (latency)

## Troubleshooting

### Binding returns null

- Check that the source is included in `buildDataContext` include list
- Verify the binding path matches the schema
- Ensure required parameters are provided
- Check that the entity exists and belongs to the organization
- For external sources, verify the source is enabled and active

### Computed field is undefined

- Verify the source data needed for computation is present
- Check the computation logic in `computed-fields-service.ts`
- Ensure the computed field is registered

### Source resolution fails

- Check required parameters are provided
- Verify entity exists in database
- Ensure organization ownership is correct
- Check repository implementation

### External source errors

- Verify endpoint URL is correct
- Check authentication credentials
- Review error logs in Settings → External Sources
- Test connection manually
- Check rate limits and API quotas
- Verify network connectivity from server


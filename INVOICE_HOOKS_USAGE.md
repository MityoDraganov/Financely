# Invoice Hooks Usage Guide

## Overview

The invoice hooks provide a React Query-based interface for creating and managing invoices. Following the architecture pattern from the-miles-market, these hooks are organized into service hooks (for Firebase Functions) and repository hooks (for direct database access).

## Available Hooks

### Service Hooks (Firebase Functions)

Located in `app/src/hooks/service-hooks/use-invoice-functions.ts`

#### `useCreateInvoice()`

Creates an invoice with dynamic data based on a template.

**Features:**
- Automatically invalidates invoice queries on success
- Returns mutation object with `mutate`, `mutateAsync`, `isLoading`, `isError`, `error`, etc.
- Type-safe with full TypeScript support

**Example:**

```tsx
import { useCreateInvoice } from "@/hooks";
import { toast } from "sonner";

function CreateInvoiceForm() {
  const createInvoice = useCreateInvoice();

  const handleSubmit = () => {
    createInvoice.mutate({
      orgId: "org_123",
      templateId: "template_456",
      data: {
        seller: {
          name: "Acme Inc",
          address: "123 Main Street",
          taxIdVat: "US-123456"
        },
        buyer: {
          name: "Customer Ltd",
          address: "456 Oak Avenue",
          taxIdVat: "US-789012"
        },
        invoiceNumber: "INV-001",
        issueDate: "2025-01-01",
        dueDate: "2025-01-31",
        items: [
          {
            description: "Consulting Services",
            qty: 10,
            unitPrice: 150,
            total: 1500
          }
        ],
        subtotal: 1500,
        vatTotal: 300,
        total: 1800
      },
      status: "draft"
    }, {
      onSuccess: (result) => {
        toast.success(`Invoice created: ${result.id}`);
      },
      onError: (error) => {
        toast.error(`Failed to create invoice: ${error.message}`);
      }
    });
  };

  return (
    <button 
      onClick={handleSubmit}
      disabled={createInvoice.isPending}
    >
      {createInvoice.isPending ? "Creating..." : "Create Invoice"}
    </button>
  );
}
```

**With async/await:**

```tsx
import { useCreateInvoice } from "@/hooks";

function CreateInvoiceButton() {
  const createInvoice = useCreateInvoice();

  const handleCreate = async () => {
    try {
      const result = await createInvoice.mutateAsync({
        orgId: "org_123",
        templateId: "template_456",
        data: {
          // ... your invoice data
        }
      });
      
      console.log("Invoice created:", result.id);
      // Navigate to invoice page
      navigate(`/invoices/${result.id}`);
    } catch (error) {
      console.error("Failed:", error);
    }
  };

  return (
    <button onClick={handleCreate}>
      Create Invoice
    </button>
  );
}
```

#### `useRenderInvoicePdf()`

Generates a PDF from an invoice using a template.

**Example:**

```tsx
import { useRenderInvoicePdf } from "@/hooks";

function InvoiceActions({ invoiceId, templateVersionId }) {
  const renderPdf = useRenderInvoicePdf();

  const handleGeneratePdf = () => {
    renderPdf.mutate({
      invoiceId,
      templateVersionId
    }, {
      onSuccess: (result) => {
        // Open PDF in new tab
        window.open(result.url, "_blank");
      }
    });
  };

  return (
    <button 
      onClick={handleGeneratePdf}
      disabled={renderPdf.isPending}
    >
      {renderPdf.isPending ? "Generating..." : "Download PDF"}
    </button>
  );
}
```

#### `useSendInvoiceEmail()`

Sends an invoice via email.

**Example:**

```tsx
import { useSendInvoiceEmail } from "@/hooks";
import { toast } from "sonner";

function EmailInvoiceButton({ invoiceId }) {
  const sendEmail = useSendInvoiceEmail();

  const handleSend = () => {
    const email = prompt("Enter recipient email:");
    if (!email) return;

    sendEmail.mutate({
      invoiceId,
      toEmail: email
    }, {
      onSuccess: () => {
        toast.success("Invoice sent successfully!");
      },
      onError: (error) => {
        toast.error(`Failed to send: ${error.message}`);
      }
    });
  };

  return (
    <button 
      onClick={handleSend}
      disabled={sendEmail.isPending}
    >
      Send Email
    </button>
  );
}
```

#### `useGenerateInvoiceShareLink()`

Generates a shareable link for an invoice.

**Example:**

```tsx
import { useGenerateInvoiceShareLink } from "@/hooks";
import { toast } from "sonner";

function ShareInvoiceButton({ invoiceId }) {
  const generateLink = useGenerateInvoiceShareLink();

  const handleShare = () => {
    generateLink.mutate({
      invoiceId
    }, {
      onSuccess: (result) => {
        navigator.clipboard.writeText(result.url);
        toast.success("Link copied to clipboard!");
      }
    });
  };

  return (
    <button onClick={handleShare}>
      {generateLink.isPending ? "Generating..." : "Share"}
    </button>
  );
}
```

### Repository Hooks (Direct Database Access)

Located in `app/src/hooks/repository-hooks/use-invoices.ts`

#### `useInvoices()`

Fetches all invoices using React Query.

**Example:**

```tsx
import { useInvoices } from "@/hooks";

function InvoicesList() {
  const { data: invoices, isLoading, error } = useInvoices();

  if (isLoading) return <div>Loading invoices...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {invoices?.map((invoice) => (
        <li key={invoice.id}>
          Invoice #{invoice.data.invoiceNumber} - {invoice.status}
        </li>
      ))}
    </ul>
  );
}
```

## Complete Form Example

Here's a complete example of a form that creates an invoice:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateInvoice } from "@/hooks";
import { invoiceDataSchema } from "@/core/entities/invoice";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface InvoiceFormProps {
  orgId: string;
  templateId: string;
}

export function InvoiceForm({ orgId, templateId }: InvoiceFormProps) {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  
  const form = useForm({
    resolver: zodResolver(invoiceDataSchema),
    defaultValues: {
      orgId,
      templateId,
      data: {
        seller: { name: "", address: "", taxIdVat: "" },
        buyer: { name: "", address: "", taxIdVat: "" },
        invoiceNumber: "",
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date().toISOString().split("T")[0],
        items: [],
        subtotal: 0,
        vatTotal: 0,
        total: 0
      },
      status: "draft" as const
    }
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await createInvoice.mutateAsync(values);
      
      toast.success("Invoice created successfully!");
      navigate(`/invoices/${result.id}`);
    } catch (error: any) {
      toast.error(`Failed to create invoice: ${error.message}`);
    }
  });

  return (
    <form onSubmit={onSubmit}>
      {/* Your form fields here */}
      
      <button 
        type="submit" 
        disabled={createInvoice.isPending}
      >
        {createInvoice.isPending ? "Creating..." : "Create Invoice"}
      </button>
      
      {createInvoice.isError && (
        <div className="error">
          {createInvoice.error.message}
        </div>
      )}
    </form>
  );
}
```

## Hook Properties

All mutation hooks return the following properties:

### State Properties
- `isPending`: `boolean` - True when mutation is in progress
- `isSuccess`: `boolean` - True when mutation succeeded
- `isError`: `boolean` - True when mutation failed
- `data`: Return type of the mutation function
- `error`: Error object if mutation failed

### Methods
- `mutate(variables, options)`: Execute mutation (fire and forget)
- `mutateAsync(variables, options)`: Execute mutation (returns Promise)
- `reset()`: Reset mutation state

### Callbacks (in options)
- `onSuccess(data, variables, context)`: Called on success
- `onError(error, variables, context)`: Called on error
- `onSettled(data, error, variables, context)`: Called when done (success or error)

## Best Practices

1. **Always handle errors**: Use `onError` or try/catch with `mutateAsync`
2. **Show loading states**: Use `isPending` to disable buttons and show spinners
3. **Provide feedback**: Use toast notifications to inform users
4. **Invalidate queries**: Hooks automatically invalidate related queries on success
5. **Type safety**: TypeScript will ensure your data matches the expected structure

## Migration from Old Hook

If you're using the old `useCreateInvoice` from `use-invoice.ts`, the new hook is a drop-in replacement:

**Old:**
```tsx
import { useCreateInvoice } from "@/hooks/use-invoice";
```

**New:**
```tsx
import { useCreateInvoice } from "@/hooks";
// or
import { useCreateInvoice } from "@/hooks/service-hooks/use-invoice-functions";
```

The API is the same, but now the data structure is dynamic based on templates.


import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useRenderInvoicePdf } from "@/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Invoice } from "@/core/entities/invoice";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Helper to safely get a value from dynamic invoice data
function getInvoiceValue(invoice: Invoice, path: string): string {
  const parts = path.split(".");
  let value: unknown = invoice.data;
  
  for (const part of parts) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return "";
    }
  }
  
  return value ? String(value) : "";
}

// Helper to format invoice display number
function getInvoiceNumber(invoice: Invoice): string {
  return (
    getInvoiceValue(invoice, "invoiceNumber") ||
    getInvoiceValue(invoice, "number") ||
    invoice.id.slice(0, 8)
  );
}

// Helper to format date
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// Helper to get invoice date
function getInvoiceDate(invoice: Invoice): string {
  const issueDate = getInvoiceValue(invoice, "issueDate") || getInvoiceValue(invoice, "date");
  return issueDate ? formatDate(issueDate) : "";
}

// Helper to get buyer/customer name
function getBuyerName(invoice: Invoice): string {
  return (
    getInvoiceValue(invoice, "buyer.name") ||
    getInvoiceValue(invoice, "customer.name") ||
    getInvoiceValue(invoice, "client.name") ||
    "Unknown"
  );
}

// Helper to get total amount
function getTotalAmount(invoice: Invoice): string {
  const total =
    getInvoiceValue(invoice, "total") ||
    getInvoiceValue(invoice, "totalAmount") ||
    getInvoiceValue(invoice, "grandTotal");
  
  if (total) {
    const num = parseFloat(total);
    return isNaN(num) ? total : num.toFixed(2);
  }
  
  return "—";
}

// Helper to get status color
function getStatusColor(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "sent":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { data: invoices, isLoading, isError } = useInvoices();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const renderPdf = useRenderInvoicePdf();

  const handleCreate = () => navigate("/create-invoice");

  const handleGeneratePdf = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    renderPdf.mutate(
      { invoiceId },
      {
        onSuccess: (result) => {
          toast.success("PDF generated successfully!");
          window.open(result.url, "_blank");
        },
        onError: (error) => {
          toast.error(`Failed to generate PDF: ${error.message}`);
        },
      }
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#eafcff] to-white p-6 md:p-10 border border-custom">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="inline-flex items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              <span className="h-2 w-2 rounded-full bg-[--accent-color]" />
              Invoices
            </div>
            <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
              Your invoices
            </h1>
            <p className="text-gray max-w-2xl">
              Review your invoices or create a new one.
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-40" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-sm text-red-500">
          Failed to load invoices. Please try again.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(invoices ?? []).map((invoice) => {
            const invoiceNumber = getInvoiceNumber(invoice);
            const invoiceDate = getInvoiceDate(invoice);
            const buyerName = getBuyerName(invoice);
            const totalAmount = getTotalAmount(invoice);

            return (
              <Card
                key={invoice.id}
                className="group cursor-pointer transition-colors hover:border-foreground/20"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      {invoiceNumber}
                    </CardTitle>
                    <Badge variant={getStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                  {invoiceDate && (
                    <p className="text-xs text-muted-foreground">{invoiceDate}</p>
                  )}
                </CardHeader>
                <CardContent className="text-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium truncate max-w-[60%] text-right">
                      {buyerName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{totalAmount}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => handleGeneratePdf(invoice.id, e)}
                      disabled={renderPdf.isPending}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      {renderPdf.isPending ? "Generating..." : "PDF"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/invoices/${invoice.id}`);
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Placeholder tile as the last element */}
          <button
            type="button"
            onClick={handleCreate}
            className="h-full min-h-40 rounded-lg border border-dashed border-muted-foreground/40 hover:border-muted-foreground/70 transition-colors flex items-center justify-center p-6 bg-muted/20"
            aria-label="Create new invoice"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Plus className="h-6 w-6" />
              <span>Create new invoice</span>
            </div>
          </button>
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Invoice preview</DialogTitle>
          </DialogHeader>
          <div className="aspect-[1/1.414] w-full overflow-hidden rounded border bg-muted">
            {previewUrl ? (
              <iframe title="invoice-preview" src={previewUrl} className="h-full w-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating create button */}
      <Button
        onClick={handleCreate}
        className="btn-primary fixed bottom-6 right-6 shadow-lg"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create invoice
      </Button>
    </div>
  );
}

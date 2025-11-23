import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useRenderInvoicePdf } from "@/hooks";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  FileText, 
  Download, 
  Search, 
  Filter,
  Calendar,
  DollarSign,
  User,
  MoreHorizontal,
  Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/core/entities/invoice";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

// Helper to get invoice date
function getInvoiceDate(invoice: Invoice, formatDateShort: (date: Date | string | number) => string): string {
  const issueDate = getInvoiceValue(invoice, "issueDate") || getInvoiceValue(invoice, "date");
  if (!issueDate) return "";
  try {
    return formatDateShort(new Date(issueDate));
  } catch {
    return issueDate;
  }
}

// Helper to get buyer/customer name
function getBuyerName(invoice: Invoice, unknownLabel: string): string {
  return (
    getInvoiceValue(invoice, "buyer.name") ||
    getInvoiceValue(invoice, "customer.name") ||
    getInvoiceValue(invoice, "client.name") ||
    unknownLabel
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
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: invoices, isLoading, isError, error } = useInvoices(currentOrganization?.id);
  console.log(error);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const renderPdf = useRenderInvoicePdf();

  const handleCreate = () => navigate("/create-invoice");

  const handleGeneratePdf = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    renderPdf.mutate(
      { invoiceId },
      {
        onSuccess: (result) => {
          toast.success(t('invoices.messages.pdfGenerated'));
          window.open(result.url, "_blank");
        },
        onError: (error) => {
          toast.error(t('invoices.messages.pdfFailed', { error: error.message }));
        },
      }
    );
  };

  // Filter invoices based on search and status
  const filteredInvoices = (invoices ?? []).filter((invoice) => {
    const matchesSearch = 
      getInvoiceNumber(invoice).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBuyerName(invoice, t('invoices.labels.unknown')).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const totalInvoices = invoices?.length || 0;
  const totalRevenue = invoices?.reduce((sum, invoice) => {
    const amount = getTotalAmount(invoice);
    const num = parseFloat(amount.replace(/[^0-9.-]/g, ''));
    return sum + (isNaN(num) ? 0 : num);
  }, 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        {/* Header Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('invoices.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('invoices.subtitle')}
              </p>
            </div>
            <Button onClick={handleCreate} className="shadow-sm w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              {t('invoices.createInvoice')}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-2.5">
                <div className="flex items-center space-x-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">{totalInvoices}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{t('invoices.stats.totalInvoices')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-2.5">
                <div className="flex items-center space-x-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">${totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{t('invoices.stats.totalRevenue')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
              <CardContent className="p-2.5">
                <div className="flex items-center space-x-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">
                      {invoices?.filter(inv => {
                        const date = new Date(inv.updatedAt || inv.createdAt || '');
                        const now = new Date();
                        const diffTime = Math.abs(now.getTime() - date.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 30;
                      }).length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">{t('invoices.stats.thisMonth')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('invoices.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t('invoices.filters.statusFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('invoices.filters.allStatus')}</SelectItem>
                <SelectItem value="draft">{t('invoices.filters.draft')}</SelectItem>
                <SelectItem value="sent">{t('invoices.filters.sent')}</SelectItem>
                <SelectItem value="paid">{t('invoices.filters.paid')}</SelectItem>
                <SelectItem value="cancelled">{t('invoices.filters.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-[150px] sm:w-[200px]" />
                      <Skeleton className="h-3 w-[100px] sm:w-[150px]" />
                    </div>
                    <Skeleton className="h-7 w-[80px] sm:w-[100px]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-destructive">
                <FileText className="mx-auto h-10 w-10 mb-3" />
                <h3 className="text-base font-semibold mb-1.5 text-foreground">{t('invoices.error.loadFailed')}</h3>
                <p className="text-sm text-muted-foreground">{t('invoices.error.tryAgain')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            {filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold mb-1.5 text-foreground">
                    {searchTerm || statusFilter !== "all" ? t('invoices.empty.noInvoicesFound') : t('invoices.empty.noInvoicesYet')}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    {searchTerm || statusFilter !== "all" 
                      ? t('invoices.empty.adjustFilters')
                      : t('invoices.empty.getStarted')
                    }
                  </p>
                  <Button onClick={handleCreate} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('invoices.createInvoice')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {filteredInvoices.map((invoice) => {
                  const invoiceNumber = getInvoiceNumber(invoice);
                  const invoiceDate = getInvoiceDate(invoice, formatDateShort);
                  const buyerName = getBuyerName(invoice, t('invoices.labels.unknown'));
                  const totalAmount = getTotalAmount(invoice);

                  return (
                    <Card key={invoice.id} className="group hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-3">
                          {/* Top Section - Invoice Info */}
                          <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1.5">
                                <h3 className="font-semibold text-sm sm:text-base truncate text-foreground">
                                  {invoiceNumber}
                                </h3>
                                <Badge variant={getStatusColor(invoice.status)} className="shrink-0 w-fit text-xs">
                                  {t(`dashboard.status.${invoice.status}`) || invoice.status}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center space-x-1">
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{buyerName}</span>
                                </div>
                                {invoiceDate && (
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    <span>{invoiceDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Section - Amount and Actions */}
                          <div className="flex items-center justify-between gap-2.5 pt-2 border-t">
                            <div className="text-left">
                              <p className="text-base sm:text-lg font-semibold">
                                ${totalAmount}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeneratePdf(invoice.id, e);
                                }}
                                disabled={renderPdf.isPending}
                                className="hidden sm:flex text-xs h-8"
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                {t('invoices.actions.pdf')}
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    {t('invoices.actions.viewDetails')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => handleGeneratePdf(invoice.id, e)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    {t('invoices.actions.downloadPdf')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('invoices.preview.title')}</DialogTitle>
          </DialogHeader>
          <div className="aspect-[1/1.414] w-full overflow-hidden rounded-md border bg-muted">
            {previewUrl ? (
              <iframe title="invoice-preview" src={previewUrl} className="h-full w-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

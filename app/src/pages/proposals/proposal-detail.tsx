import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, FileText, User, Mail, Phone, Building2, MessageSquare, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProposal } from "@/hooks/repository-hooks/use-proposals";
import { useLead } from "@/hooks/repository-hooks/use-leads";
import { PROPOSAL_STATUSES } from "@/core";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useGenerateInvoiceFromProposal } from "@/hooks/service-hooks/use-generate-invoice-from-proposal";
import { useCreateInvoice } from "@/hooks";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { getBindingValue, setBindingValue } from "@/core/entities/invoice";
import { useUpdateProposal } from "@/hooks/repository-hooks/use-proposals";

export default function ProposalDetailPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useProposal(id);
  const { data: lead, isLoading: isLeadLoading } = useLead(proposal?.leadId);
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);
  const generateInvoice = useGenerateInvoiceFromProposal();
  const createInvoice = useCreateInvoice();
  const updateProposal = useUpdateProposal();
  
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [generatedInvoiceData, setGeneratedInvoiceData] = useState<{
    invoiceData: Record<string, InvoiceDataValue>;
    invoiceNumber?: string;
    templateId: string;
  } | null>(null);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case PROPOSAL_STATUSES.DRAFT:
        return "bg-gray-100 text-gray-800";
      case PROPOSAL_STATUSES.SENT:
        return "bg-blue-100 text-blue-800";
      case PROPOSAL_STATUSES.ACCEPTED:
        return "bg-green-100 text-green-800";
      case PROPOSAL_STATUSES.REJECTED:
        return "bg-red-100 text-red-800";
      case PROPOSAL_STATUSES.EXPIRED:
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">{t('proposalDetail.notFound.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('proposalDetail.notFound.description')}
          </p>
          <Button className="mt-4" onClick={() => navigate("/proposals")}>
            {t('proposalDetail.notFound.backButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/proposals")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('proposalDetail.back')}
          </Button>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{proposal.title}</h1>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(proposal.status)}>
                  {t(`proposals.status.${proposal.status}`)}
                </Badge>
                {proposal.createdAt && (
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t('proposalDetail.created', { date: formatDateTable(proposal.createdAt) })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Incomplete Proposal Warning */}
        {proposal.isIncomplete && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('proposalDetail.incomplete.title')}</AlertTitle>
            <AlertDescription>
              {t('proposalDetail.incomplete.description')}
              {proposal.incompleteItems && proposal.incompleteItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="font-medium">{t('proposalDetail.incomplete.missingProducts')}</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {proposal.incompleteItems.map((item: { description: string; reason: string; suggestedProductId?: string }, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{item.description}</span>
                        {item.reason && <span className="text-muted-foreground"> - {item.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-sm">
                {t('proposalDetail.incomplete.reviewItems')}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Proposal Details */}
        <div className="
        ">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {proposal.description && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('proposalDetail.sections.description')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{proposal.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>{t('proposalDetail.sections.items')}</CardTitle>
                <CardDescription>
                  {proposal.items.length === 1
                    ? t('proposalDetail.sections.itemsCount', { count: proposal.items.length })
                    : t('proposalDetail.sections.itemsCountPlural', { count: proposal.items.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proposal.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.qty} × {formatCurrency(item.unitPrice, proposal.currency)}
                          {item.taxPct && item.taxPct > 0 && (
                            <span className="ml-2">{t('proposalDetail.labels.tax', { tax: item.taxPct })}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(
                            item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100),
                            proposal.currency
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Terms and Notes */}
            {(proposal.terms || proposal.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('proposalDetail.sections.additionalInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {proposal.terms && (
                    <div>
                      <h4 className="font-medium mb-2">{t('proposalDetail.sections.paymentTerms')}</h4>
                      <p className="text-sm text-muted-foreground">{proposal.terms}</p>
                    </div>
                  )}
                  {proposal.notes && (
                    <div>
                      <h4 className="font-medium mb-2">{t('proposalDetail.sections.notes')}</h4>
                      <p className="text-sm text-muted-foreground">{proposal.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t('proposalDetail.sections.summary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('proposalDetail.sections.subtotal')}</span>
                  <span className="font-medium">
                    {formatCurrency(proposal.subtotal, proposal.currency)}
                  </span>
                </div>
                {proposal.taxTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('proposalDetail.sections.tax')}</span>
                    <span className="font-medium">
                      {formatCurrency(proposal.taxTotal, proposal.currency)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="font-semibold">{t('proposalDetail.sections.total')}</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(proposal.total, proposal.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Lead/Client Information */}
            {proposal.leadId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('proposalDetail.sections.clientInfo')}
                  </CardTitle>
                  <CardDescription>
                    {isLeadLoading ? t('proposalDetail.sections.loading') : lead ? t('proposalDetail.sections.linkedToLead') : t('proposalDetail.sections.leadNotFound')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLeadLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : lead ? (
                    <div className="space-y-4">
                      {/* Contact Name */}
                      {(lead.data?.firstName || lead.data?.lastName) && (
                        <div className="flex items-start gap-3">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              {[lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ") || t('proposalDetail.labels.unknown')}
                            </p>
                            {lead.data.jobTitle && (
                              <p className="text-xs text-muted-foreground">{lead.data.jobTitle}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Company */}
                      {lead.data?.company && (
                        <div className="flex items-start gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{lead.data.company}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Email */}
                      {lead.data?.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <a 
                              href={`mailto:${lead.data.email}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {lead.data.email}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Phone */}
                      {lead.data?.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <a 
                              href={`tel:${lead.data.phone}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {lead.data.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Message */}
                      {lead.data?.message && (
                        <div className="flex items-start gap-3 pt-2 border-t">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t('proposalDetail.sections.message')}</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {lead.data.message}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Lead Status */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{t('proposalDetail.sections.leadStatus')}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {t(`leads.status.${lead.data?.status || "new"}`)}
                          </Badge>
                        </div>
                        {lead.data?.widgetType && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">{t('proposalDetail.sections.source')}</span>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {t(`leads.widgetType.${lead.data.widgetType}`)}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('proposalDetail.sections.leadInfoNotAvailable')}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>{t('proposalDetail.sections.details')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('proposalDetail.sections.currency')}</span>
                  <span className="font-medium">{proposal.currency}</span>
                </div>
                {proposal.leadId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('proposalDetail.sections.leadId')}</span>
                    <span className="font-medium font-mono text-xs">{proposal.leadId.slice(0, 8)}</span>
                  </div>
                )}
                {proposal.invoiceId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('proposalDetail.sections.invoiceId')}</span>
                    <span className="font-medium font-mono text-xs">{proposal.invoiceId.slice(0, 8)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Convert to Invoice */}
            {!proposal.invoiceId && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('proposalDetail.sections.actions')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setConvertDialogOpen(true)}
                    className="w-full"
                    variant="default"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('proposalDetail.sections.convertToInvoice')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Convert to Invoice Dialog */}
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('proposalDetail.convert.title')}
            </DialogTitle>
            <DialogDescription>
              {t('proposalDetail.convert.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('proposalDetail.convert.templateLabel')}</Label>
              {isTemplatesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('proposalDetail.convert.templatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name || template.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {templates && templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('proposalDetail.convert.noTemplates')}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={generateInvoice.isPending}
            >
              {t('proposalDetail.convert.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTemplateId) {
                  toast.error(t('proposalDetail.convert.selectTemplate'));
                  return;
                }
                if (!proposal) {
                  toast.error(t('proposalDetail.convert.proposalNotFound'));
                  return;
                }
                if (!currentOrganization) {
                  toast.error(t('proposalDetail.convert.orgNotFound'));
                  return;
                }

                try {
                  // Generate invoice data (without creating it)
                  const result = await generateInvoice.mutateAsync({
                    proposalId: proposal.id,
                    templateId: selectedTemplateId,
                    organizationId: currentOrganization.id,
                  });
                  
                  // Store generated data and open review dialog
                  setGeneratedInvoiceData({
                    ...result,
                    invoiceData: result.invoiceData as Record<string, InvoiceDataValue>,
                  });
                  setConvertDialogOpen(false);
                  setReviewDialogOpen(true);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(t('proposalDetail.convert.generateFailed', { error: message }));
                }
              }}
              disabled={generateInvoice.isPending || !selectedTemplateId || !templates || templates.length === 0}
            >
              {generateInvoice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('proposalDetail.convert.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('proposalDetail.convert.generate')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review & Edit Invoice Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('proposalDetail.review.title')}
            </DialogTitle>
            <DialogDescription>
              {t('proposalDetail.review.description')}
            </DialogDescription>
          </DialogHeader>
          
          {generatedInvoiceData && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Invoice Number */}
                {generatedInvoiceData.invoiceNumber && (
                  <div className="space-y-2">
                    <Label>{t('proposalDetail.review.invoiceNumber')}</Label>
                    <Input
                      value={generatedInvoiceData.invoiceNumber}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                )}

                {/* Key Fields - Seller */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.sellerInfo')}</h3>
                  {Object.entries(generatedInvoiceData.invoiceData).filter(([key]) => 
                    key.startsWith("seller.") || key.startsWith("supplier.")
                  ).map(([key, value]) => {
                    const fieldName = key.split(".").pop() || key;
                    const label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, " $1");
                    const isAddress = fieldName === "address";
                    
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        {isAddress && typeof value === "object" && value !== null ? (
                          <div className="space-y-2">
                            {Object.entries(value as Record<string, unknown>).map(([addrKey, addrValue]) => (
                              <Input
                                key={addrKey}
                                value={String(addrValue || "")}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newData = { ...generatedInvoiceData.invoiceData };
                                  const addr = (getBindingValue(newData, key) as Record<string, unknown>) || {};
                                  setBindingValue(newData, key, { ...addr, [addrKey]: e.target.value } as InvoiceDataValue);
                                  setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                }}
                                placeholder={addrKey.charAt(0).toUpperCase() + addrKey.slice(1)}
                              />
                            ))}
                          </div>
                        ) : (
                          <Input
                            value={String(value || "")}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const newData = { ...generatedInvoiceData.invoiceData };
                              setBindingValue(newData, key, e.target.value);
                              setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Key Fields - Customer */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.customerInfo')}</h3>
                  {Object.entries(generatedInvoiceData.invoiceData).filter(([key]) => 
                    key.startsWith("customer.") || key.startsWith("buyer.")
                  ).map(([key, value]) => {
                    const fieldName = key.split(".").pop() || key;
                    const label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, " $1");
                    const isAddress = fieldName === "address";
                    
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        {isAddress && typeof value === "object" && value !== null ? (
                          <div className="space-y-2">
                            {Object.entries(value as Record<string, unknown>).map(([addrKey, addrValue]) => (
                              <Input
                                key={addrKey}
                                value={String(addrValue || "")}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newData = { ...generatedInvoiceData.invoiceData };
                                  const addr = (getBindingValue(newData, key) as Record<string, unknown>) || {};
                                  setBindingValue(newData, key, { ...addr, [addrKey]: e.target.value } as InvoiceDataValue);
                                  setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                }}
                                placeholder={addrKey.charAt(0).toUpperCase() + addrKey.slice(1)}
                              />
                            ))}
                          </div>
                        ) : (
                          <Input
                            value={String(value || "")}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const newData = { ...generatedInvoiceData.invoiceData };
                              setBindingValue(newData, key, e.target.value);
                              setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Invoice Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.invoiceDetails')}</h3>
                  {["invoiceNumber", "invoiceDate", "issueDate", "dueDate", "currency"].map((key) => {
                    const value = generatedInvoiceData.invoiceData[key];
                    if (value === undefined) return null;
                    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{label}</Label>
                        <Input
                          value={String(value || "")}
                          onChange={(e) => {
                            const newData = { ...generatedInvoiceData.invoiceData };
                            setBindingValue(newData, key, e.target.value);
                            setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Items Table Preview */}
                {generatedInvoiceData.invoiceData.items && Array.isArray(generatedInvoiceData.invoiceData.items) && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">{t('proposalDetail.review.items')}</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">{t('proposalDetail.review.items')}</th>
                              <th className="p-2 text-right">{t('leads.proposal.qty')}</th>
                              <th className="p-2 text-right">{t('leads.proposal.unitPrice')}</th>
                              <th className="p-2 text-right">{t('proposalDetail.sections.total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(generatedInvoiceData.invoiceData.items as Array<Record<string, unknown>>).map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{String(item.description || "")}</td>
                                <td className="p-2 text-right">{String(item.qty || item.quantity || "")}</td>
                                <td className="p-2 text-right">{String(item.unitPrice || item.price || "")}</td>
                                <td className="p-2 text-right">{String(item.total || item.amount || "")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('proposalDetail.review.itemsEditable')}
                    </p>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.totals')}</h3>
                  {["subtotal", "netAmount", "taxTotal", "vatTotal", "total", "grossTotal"].map((key) => {
                    const value = generatedInvoiceData.invoiceData[key];
                    if (value === undefined) return null;
                    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <Label>{label}</Label>
                        <Input
                          value={String(value || "")}
                          onChange={(e) => {
                            const newData = { ...generatedInvoiceData.invoiceData };
                            setBindingValue(newData, key, e.target.value);
                            setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                          }}
                          className="w-32"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setGeneratedInvoiceData(null);
              }}
              disabled={createInvoice.isPending}
            >
              {t('proposalDetail.review.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!generatedInvoiceData || !currentOrganization) {
                  toast.error(t('proposalDetail.review.missingData'));
                  return;
                }

                try {
                  const result = await createInvoice.mutateAsync({
                    orgId: currentOrganization.id,
                    templateId: generatedInvoiceData.templateId,
                    data: generatedInvoiceData.invoiceData,
                    status: "draft",
                  });
                  
                  toast.success(t('proposalDetail.review.createSuccess'));
                  setReviewDialogOpen(false);
                  setGeneratedInvoiceData(null);
                  
                  // Update proposal to link to invoice
                  if (proposal) {
                    try {
                      await updateProposal.mutateAsync({
                        id: proposal.id,
                        data: { invoiceId: result.id },
                      });
                    } catch (error) {
                      // Silently fail - invoice is already created
                      console.warn("Failed to link proposal to invoice:", error);
                    }
                  }
                  
                  navigate(`/invoices/${result.id}`);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(t('proposalDetail.review.createFailed', { error: message }));
                }
              }}
              disabled={createInvoice.isPending || !generatedInvoiceData}
            >
              {createInvoice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('proposalDetail.review.creating')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('proposalDetail.review.create')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  );
}


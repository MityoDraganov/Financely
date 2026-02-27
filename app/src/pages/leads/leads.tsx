import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Search, Mail, Phone, Building, MessageSquare, Calendar, Eye, Sparkles, FileText, Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeadsByOrg, useUpdateLead } from "@/hooks/repository-hooks/use-leads";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Lead, ProposalData, ProposalItem } from "@/core";
import { ProposalSuggestionDialog } from "@/components/proposal-suggestion-dialog";
import { useCreateProposal } from "@/hooks/repository-hooks/use-proposals";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getAllCurrencyCodes } from "@/utils/currencies";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { extractUrls, getFileLabelFromUrl } from "@/utils/file-links";

export default function LeadsPage() {
  const { t } = useTranslation();
  const { formatDateTable, formatDateTime } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const { data: organization } = useCurrentOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const [leadForSuggestion, setLeadForSuggestion] = useState<Lead | null>(null);
  const [isManualProposalDialogOpen, setIsManualProposalDialogOpen] = useState(false);
  const [leadForManualProposal, setLeadForManualProposal] = useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [widgetTypeFilter, setWidgetTypeFilter] = useState<string>("all");
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Queries
  const { data: leads = [], isLoading: isLoadingLeads } = useLeadsByOrg(currentOrganization?.id);
  const updateLeadMutation = useUpdateLead();

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const leadData = lead.data || lead;
    
    // Status filter
    if (statusFilter !== "all" && leadData.status !== statusFilter) {
      return false;
    }

    // Widget type filter
    if (widgetTypeFilter !== "all" && leadData.widgetType !== widgetTypeFilter) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const firstName = (leadData.firstName || "").toLowerCase();
      const lastName = (leadData.lastName || "").toLowerCase();
      const email = (leadData.email || "").toLowerCase();
      const company = (leadData.company || "").toLowerCase();
      const message = (leadData.message || "").toLowerCase();
      
      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        email.includes(searchLower) ||
        company.includes(searchLower) ||
        message.includes(searchLower)
      );
    }

    return true;
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await updateLeadMutation.mutateAsync({
      id: leadId,
      data: { status: newStatus as Lead["data"]["status"] },
    });
  };

  const openDetailDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDialogOpen(true);
  };

  const openSuggestionDialog = (lead: Lead) => {
    setLeadForSuggestion(lead);
    setIsSuggestionDialogOpen(true);
  };

  const openManualProposalDialog = (lead: Lead) => {
    setLeadForManualProposal(lead);
    setIsManualProposalDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "viewed": return "bg-yellow-100 text-yellow-800";
      case "contacted": return "bg-purple-100 text-purple-800";
      case "converted": return "bg-green-100 text-green-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getWidgetTypeLabel = (widgetType: string) => {
    const key = `leads.widgetType.${widgetType}`;
    const translated = t(key);
    return translated !== key ? translated : widgetType;
  };

  const getWidgetTypeColor = (widgetType: string) => {
    switch (widgetType) {
      case "contactForm": return "bg-blue-100 text-blue-800";
      case "invoiceRequest": return "bg-green-100 text-green-800";
      case "quoteRequest": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderFormDataValue = (value: unknown) => {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    const raw = String(value ?? "").trim();
    if (!raw) {
      return t("leads.detail.na");
    }
    const urls = extractUrls(raw);
    if (urls.length === 0) {
      return raw;
    }
    return (
      <div className="space-y-1">
        {urls.map((url) => (
          <div key={url} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{getFileLabelFromUrl(url)}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              Open
            </a>
            <a href={url} download className="underline text-primary">
              Download
            </a>
          </div>
        ))}
      </div>
    );
  };

  if (isLoadingLeads) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('leads.title')}</h1>
            <p className="text-muted-foreground">{t('leads.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('leads.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 pr-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('leads.title')}</h1>
          <p className="text-muted-foreground">{t('leads.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => setShowExportDialog(true)}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('leads.filters.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('leads.filters.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leads.filters.allStatuses')}</SelectItem>
            <SelectItem value="new">{t('leads.status.new')}</SelectItem>
            <SelectItem value="viewed">{t('leads.status.viewed')}</SelectItem>
            <SelectItem value="contacted">{t('leads.status.contacted')}</SelectItem>
            <SelectItem value="converted">{t('leads.status.converted')}</SelectItem>
            <SelectItem value="archived">{t('leads.status.archived')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={widgetTypeFilter} onValueChange={setWidgetTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('leads.filters.typeFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('leads.filters.allTypes')}</SelectItem>
            <SelectItem value="contactForm">{t('leads.widgetType.contactForm')}</SelectItem>
            <SelectItem value="invoiceRequest">{t('leads.widgetType.invoiceRequest')}</SelectItem>
            <SelectItem value="quoteRequest">{t('leads.widgetType.quoteRequest')}</SelectItem>
          </SelectContent>
        </Select>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredLeads.length}</span>
            <span className="text-sm text-muted-foreground">{t('leads.filters.lead')}</span>
          </div>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('leads.table.title')}</CardTitle>
          <CardDescription>
            {searchTerm.trim() || statusFilter !== "all" || widgetTypeFilter !== "all"
              ? t('leads.table.showing', { count: filteredLeads.length, total: leads.length })
              : t('leads.table.showingAll', { count: leads.length })
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{t('leads.empty.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim() || statusFilter !== "all" || widgetTypeFilter !== "all"
                  ? t('leads.empty.noMatch')
                  : t('leads.empty.noSubmissions')
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('leads.table.date')}</TableHead>
                  <TableHead>{t('leads.table.name')}</TableHead>
                  <TableHead>{t('leads.table.email')}</TableHead>
                  <TableHead>{t('leads.table.type')}</TableHead>
                  <TableHead>{t('leads.table.message')}</TableHead>
                  <TableHead>{t('leads.table.status')}</TableHead>
                  <TableHead className="w-[120px]">{t('leads.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const leadData = lead.data || lead;
                  
                  if (!lead || !lead.id) {
                    return null;
                  }
                  
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {lead.createdAt 
                              ? formatDateTable(lead.createdAt)
                              : t('leads.detail.na')
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {leadData.firstName || leadData.lastName
                          ? `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim()
                          : t('leads.detail.na')
                        }
                      </TableCell>
                      <TableCell>
                        {leadData.email ? (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{leadData.email}</span>
                          </div>
                        ) : (
                          t('leads.detail.na')
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getWidgetTypeColor(leadData.widgetType)}>
                          {getWidgetTypeLabel(leadData.widgetType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate">
                          {leadData.message || t('leads.detail.noMessage')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(leadData.status || "new")}>
                          {t(`leads.status.${leadData.status || "new"}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailDialog(lead)}
                            title={t('leads.actions.viewDetails')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSuggestionDialog(lead)}
                            title={t('leads.actions.generateProposal')}
                          >
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManualProposalDialog(lead)}
                            title={t('leads.actions.createProposal')}
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Select
                            value={leadData.status || "new"}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger className="h-8 w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">{t('leads.status.new')}</SelectItem>
                              <SelectItem value="viewed">{t('leads.status.viewed')}</SelectItem>
                              <SelectItem value="contacted">{t('leads.status.contacted')}</SelectItem>
                              <SelectItem value="converted">{t('leads.status.converted')}</SelectItem>
                              <SelectItem value="archived">{t('leads.status.archived')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('leads.detail.title')}</DialogTitle>
            <DialogDescription>
              {t('leads.detail.description')}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (() => {
            // Use the same data access pattern as in the table (lead.data || lead)
            const leadData = selectedLead.data || selectedLead;
            
            return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.detail.dateSubmitted')}</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedLead.createdAt 
                      ? formatDateTime(selectedLead.createdAt)
                      : t('leads.detail.na')
                    }
                  </div>
                </div>
                  <div className="space-y-2">
                    <Label>{t('leads.detail.lastUpdated')}</Label>
                    <div className="text-sm text-muted-foreground">
                      {selectedLead.updatedAt 
                        ? formatDateTime(selectedLead.updatedAt)
                        : selectedLead.createdAt
                          ? formatDateTime(selectedLead.createdAt)
                          : t('leads.detail.na')
                      }
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.detail.status')}</Label>
                  <Select
                      value={leadData.status || "new"}
                    onValueChange={(value) => handleStatusChange(selectedLead.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">{t('leads.status.new')}</SelectItem>
                      <SelectItem value="viewed">{t('leads.status.viewed')}</SelectItem>
                      <SelectItem value="contacted">{t('leads.status.contacted')}</SelectItem>
                      <SelectItem value="converted">{t('leads.status.converted')}</SelectItem>
                      <SelectItem value="archived">{t('leads.status.archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  <div className="space-y-2">
                    <Label>{t('leads.detail.leadId')}</Label>
                    <div className="text-sm text-muted-foreground font-mono">
                      {selectedLead.id}
                    </div>
                  </div>
              </div>

                <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('leads.detail.widgetType')}</Label>
                    <Badge className={getWidgetTypeColor(leadData.widgetType || "")}>
                      {getWidgetTypeLabel(leadData.widgetType || "")}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('leads.detail.source')}</Label>
                    <Badge variant="outline" className="capitalize">
                      {leadData.source || "widget"}
                </Badge>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.detail.name')}</Label>
                  <div className="text-sm">
                      {leadData.firstName || leadData.lastName
                        ? `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim()
                      : t('leads.detail.na')
                    }
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('leads.detail.email')}</Label>
                  <div className="text-sm flex items-center space-x-2">
                      {leadData.email ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{leadData.email}</span>
                      </>
                    ) : (
                      t('leads.detail.na')
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('leads.detail.phone')}</Label>
                  <div className="text-sm flex items-center space-x-2">
                      {leadData.phone ? (
                      <>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{leadData.phone}</span>
                      </>
                    ) : (
                      t('leads.detail.na')
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('leads.detail.company')}</Label>
                  <div className="text-sm flex items-center space-x-2">
                      {leadData.company ? (
                      <>
                        <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{leadData.company}</span>
                      </>
                    ) : (
                      t('leads.detail.na')
                    )}
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-2 gap-4">
                  {leadData.jobTitle && (
                <div className="space-y-2">
                  <Label>{t('leads.detail.jobTitle')}</Label>
                      <div className="text-sm">{leadData.jobTitle}</div>
                    </div>
                  )}
                  {leadData.contactId && (
                    <div className="space-y-2">
                      <Label>{t('leads.detail.linkedContact')}</Label>
                      <div className="text-sm text-muted-foreground">
                        {t('leads.detail.contactId', { id: leadData.contactId })}
                      </div>
                    </div>
                  )}
                </div>

              <div className="space-y-2">
                <Label>{t('leads.detail.message')}</Label>
                <Textarea
                    value={leadData.message || ""}
                  readOnly
                  rows={4}
                  className="bg-muted"
                    placeholder={t('leads.detail.noMessage')}
                />
              </div>

                {leadData.formData && Object.keys(leadData.formData).length > 0 && (
                <div className="space-y-2">
                  <Label>{t('leads.detail.formData')}</Label>
                    <div className="bg-muted p-4 rounded-md space-y-2">
                      {Object.entries(leadData.formData).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                          <span className="font-medium text-sm min-w-[120px] capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}:
                          </span>
                          <div className="text-sm text-muted-foreground flex-1">
                            {renderFormDataValue(value)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

                {leadData.notes && (
                <div className="space-y-2">
                  <Label>{t('leads.detail.internalNotes')}</Label>
                  <Textarea
                      value={leadData.notes}
                    readOnly
                    rows={3}
                    className="bg-muted"
                  />
                </div>
              )}

                {leadData.tags && leadData.tags.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('leads.detail.tags')}</Label>
                  <div className="flex flex-wrap gap-2">
                      {leadData.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              {t('leads.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal Suggestion Dialog */}
      {leadForSuggestion && (
        <ProposalSuggestionDialog
          open={isSuggestionDialogOpen}
          onOpenChange={setIsSuggestionDialogOpen}
          leadId={leadForSuggestion.id}
          leadData={leadForSuggestion.data || leadForSuggestion}
          organizationName={organization?.name}
        />
      )}

      {/* Manual Proposal Creation Dialog */}
      {leadForManualProposal && organization && (
        <ManualProposalDialog
          open={isManualProposalDialogOpen}
          onOpenChange={setIsManualProposalDialogOpen}
          lead={leadForManualProposal}
          organization={organization}
        />
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["leads"]}
      />
    </div>
  );
}

// Manual Proposal Creation Dialog Component
function ManualProposalDialog({
  open,
  onOpenChange,
  lead,
  organization,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  organization?: { id?: string; settings?: { defaultCurrency?: string } };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const leadData = lead.data || lead;
  const [proposalTitle, setProposalTitle] = useState(
    `Proposal for ${leadData.company || [leadData.firstName, leadData.lastName].filter(Boolean).join(" ") || "Lead"}`
  );
  const [proposalDescription, setProposalDescription] = useState(leadData.message || "");
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    { description: "", qty: 1, unitPrice: 0, taxPct: 0 },
  ]);
  const [currency, setCurrency] = useState(organization?.settings?.defaultCurrency || "USD");
  const [terms, setTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");

  const createProposalMutation = useCreateProposal();

  const handleAddItem = () => {
    setProposalItems([...proposalItems, { description: "", qty: 1, unitPrice: 0, taxPct: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (proposalItems.length > 1) {
      setProposalItems(proposalItems.filter((_, i) => i !== index));
    }
  };

  const handleUpdateItem = (index: number, field: keyof ProposalItem, value: string | number) => {
    const updated = [...proposalItems];
    updated[index] = { ...updated[index], [field]: value };
    setProposalItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = proposalItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const taxTotal = proposalItems.reduce(
      (sum, item) => sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
      0
    );
    return { subtotal, taxTotal, total: subtotal + taxTotal };
  };

  const handleCreate = async () => {
    if (!proposalTitle.trim()) {
      toast.error(t('leads.messages.titleRequired'));
      return;
    }

    if (proposalItems.length === 0 || proposalItems.some(item => !item.description.trim())) {
      toast.error(t('leads.messages.itemsRequired'));
      return;
    }

    if (!organization?.id) {
      toast.error(t('leads.messages.orgNotFound'));
      return;
    }

    const totals = calculateTotals();

    const proposalData: ProposalData = {
      organizationId: organization.id,
      leadId: lead.id,
      title: proposalTitle,
      description: proposalDescription || undefined,
      status: "DRAFT",
      items: proposalItems,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      currency,
      terms: terms || undefined,
      notes: notes || undefined,
      aiGenerated: false, // Manual proposal creation
      isIncomplete: false,
    };

    try {
      const proposalId = await createProposalMutation.mutateAsync(proposalData);
      toast.success(t('leads.messages.proposalCreated'));
      onOpenChange(false);
      // Navigate to the proposal detail page
      navigate(`/proposals/${proposalId}`);
    } catch (error) {
      toast.error(
        t('leads.messages.proposalFailed', { error: error instanceof Error ? error.message : "Unknown error" })
      );
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('leads.proposal.title')}</DialogTitle>
          <DialogDescription>
            {t('leads.proposal.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('leads.proposal.proposalTitle')}</Label>
            <Input
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder={t('leads.proposal.proposalTitlePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('leads.proposal.descriptionLabel')}</Label>
            <Textarea
              value={proposalDescription}
              onChange={(e) => setProposalDescription(e.target.value)}
              placeholder={t('leads.proposal.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('leads.proposal.items')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                {t('leads.proposal.addItem')}
              </Button>
            </div>
            <div className="space-y-3 border rounded-lg p-4">
              {proposalItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs">{t('leads.proposal.itemDescription')}</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                      placeholder={t('leads.proposal.itemDescriptionPlaceholder')}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">{t('leads.proposal.qty')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => handleUpdateItem(index, "qty", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">{t('leads.proposal.unitPrice')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">{t('leads.proposal.taxPct')}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.taxPct || 0}
                      onChange={(e) => handleUpdateItem(index, "taxPct", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1">
                    {proposalItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 hover:text-red-700"
                        title={t('leads.proposal.removeItem')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('leads.proposal.currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {getAllCurrencyCodes().map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('leads.proposal.paymentTerms')}</Label>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder={t('leads.proposal.paymentTermsPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('leads.proposal.subtotal')}</Label>
              <div className="text-sm font-semibold pt-2">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(totals.subtotal)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('leads.proposal.taxTotal')}</Label>
              <div className="text-sm font-semibold pt-2">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(totals.taxTotal)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('leads.proposal.total')}</Label>
              <div className="text-lg font-bold pt-2">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(totals.total)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('leads.proposal.notes')}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('leads.proposal.notesPlaceholder')}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('leads.proposal.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createProposalMutation.isPending}
          >
            {createProposalMutation.isPending ? t('leads.proposal.creating') : t('leads.proposal.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

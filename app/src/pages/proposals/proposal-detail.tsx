import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, FileText, User, Mail, Phone, Building2,
  MessageSquare, Sparkles, Loader2, AlertTriangle, MapPin, Tag,
  ChevronRight, Send, Receipt, Globe, Linkedin, Twitter, CheckCircle2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProposal } from "@/hooks/repository-hooks/use-proposals";
import { useLead } from "@/hooks/repository-hooks/use-leads";
import { useContact } from "@/hooks/repository-hooks/use-contacts";
import {
  PROPOSAL_STATUSES,
  normalizeProposalStatus,
  type ProposalDeliveryEvent,
  type LeadData,
  type ContactData,
} from "@/core";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useGenerateInvoiceFromProposal } from "@/hooks/service-hooks/use-generate-invoice-from-proposal";
import { useCreateInvoice, useSendProposalEmail } from "@/hooks";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { getBindingValue, setBindingValue } from "@/core/entities/invoice";
import { useUpdateProposal } from "@/hooks/repository-hooks/use-proposals";
import { extractTemplateBindings } from "@/utils/invoice-compliance";
import { isTemplateCompatibleWithContext } from "@/utils/email-template-compatibility";
import { cn } from "@/lib/utils";
import { formatProposalCurrency } from "@/utils/proposal-currency";

const normalizeFieldKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const readStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const fromEntry = readStringValue(entry);
      if (fromEntry) return fromEntry;
    }
  }
  return undefined;
};

const flattenDataForDisplay = (
  input: unknown,
  parentKey = "",
): Array<{ key: string; value: string }> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  const rows: Array<{ key: string; value: string }> = [];
  const objectValue = input as Record<string, unknown>;

  Object.entries(objectValue).forEach(([rawKey, rawValue]) => {
    const key = parentKey ? `${parentKey}.${rawKey}` : rawKey;
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return;
    }

    if (Array.isArray(rawValue)) {
      const primitiveValues = rawValue
        .map((entry) => (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" ? String(entry) : ""))
        .filter(Boolean);
      rows.push({
        key,
        value:
          primitiveValues.length > 0
            ? primitiveValues.join(", ")
            : JSON.stringify(rawValue),
      });
      return;
    }

    if (typeof rawValue === "object") {
      rows.push(...flattenDataForDisplay(rawValue, key));
      return;
    }

    rows.push({ key, value: String(rawValue) });
  });

  return rows;
};

const formatFieldPath = (path: string): string =>
  path
    .split(".")
    .map((part) =>
      part
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/^./, (char) => char.toUpperCase()),
    )
    .join(" > ");

const isLikelyEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const extractEntityData = (entity: unknown): Record<string, unknown> | undefined => {
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    return undefined;
  }

  const raw = entity as Record<string, unknown>;
  const nested = raw.data;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }

  return raw;
};

export default function ProposalDetailPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useProposal(id);
  const { data: lead, isLoading: isLeadLoading } = useLead(proposal?.leadId);
  const leadData = extractEntityData(lead) as Partial<LeadData> | undefined;
  const leadContactId = typeof leadData?.contactId === "string" ? leadData.contactId : undefined;
  const { data: contactFromLead, isLoading: isLeadContactLoading } = useContact(leadContactId);
  const shouldTryProposalLeadIdAsContactId = Boolean(proposal?.leadId && !leadContactId);
  const { data: contactFromProposalLeadId, isLoading: isFallbackContactLoading } = useContact(
    shouldTryProposalLeadIdAsContactId ? proposal?.leadId : undefined,
  );
  const contact = contactFromLead || contactFromProposalLeadId;
  const contactData = extractEntityData(contact) as Partial<ContactData> | undefined;
  const isClientInfoLoading = isLeadLoading || isLeadContactLoading || isFallbackContactLoading;
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);
  const { data: emailTemplates = [], isLoading: isEmailTemplatesLoading } = useEmailTemplates(currentOrganization?.id || "");
  const generateInvoice = useGenerateInvoiceFromProposal();
  const createInvoice = useCreateInvoice();
  const sendProposalEmail = useSendProposalEmail();
  const updateProposal = useUpdateProposal();

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [proposalRecipientEmail, setProposalRecipientEmail] = useState<string>("");
  const [selectedProposalEmailTemplateId, setSelectedProposalEmailTemplateId] = useState<string>("__none__");
  const [isCapturedClientDataOpen, setIsCapturedClientDataOpen] = useState(false);
  const [generatedInvoiceData, setGeneratedInvoiceData] = useState<{
    invoiceData: Record<string, InvoiceDataValue>;
    invoiceNumber?: string;
    templateId: string;
  } | null>(null);

  const compatibleProposalEmailTemplates = useMemo(
    () =>
      emailTemplates.filter((template) =>
        isTemplateCompatibleWithContext(template, "proposal_send"),
      ),
    [emailTemplates],
  );

  useEffect(() => {
    if (selectedProposalEmailTemplateId === "__none__") return;

    const isStillCompatible = compatibleProposalEmailTemplates.some(
      (template) => template.id === selectedProposalEmailTemplateId,
    );
    if (!isStillCompatible) {
      setSelectedProposalEmailTemplateId("__none__");
    }
  }, [compatibleProposalEmailTemplates, selectedProposalEmailTemplateId]);

  const formatCurrency = (amount: unknown, currency: string) => {
    return formatProposalCurrency(amount, currency);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case PROPOSAL_STATUSES.CREATED:
        return { className: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" };
      case PROPOSAL_STATUSES.SENT:
        return { className: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" };
      case PROPOSAL_STATUSES.ACCEPTED:
        return { className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
      case PROPOSAL_STATUSES.INVOICED:
        return { className: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" };
      case PROPOSAL_STATUSES.REJECTED:
        return { className: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" };
      case PROPOSAL_STATUSES.EXPIRED:
        return { className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
      default:
        return { className: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" };
    }
  };

  const handleSendProposalEmail = () => {
    if (!proposalRecipientEmail.trim()) {
      toast.error(t("proposalDetail.email.recipientRequired"));
      return;
    }
    if (!proposal) {
      toast.error(t("proposalDetail.email.proposalNotFound"));
      return;
    }
    sendProposalEmail.mutate(
      {
        proposalId: proposal.id,
        toEmail: proposalRecipientEmail.trim(),
        emailTemplateId:
          selectedProposalEmailTemplateId !== "__none__"
            ? selectedProposalEmailTemplateId
            : undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            t("proposalDetail.email.sentTo", {
              email: proposalRecipientEmail.trim(),
            }),
          );
        },
        onError: (error) => {
          toast.error(
            t("proposalDetail.email.sendFailed", { error: error.message }),
          );
        },
      },
    );
  };

  const toDeliveryHistory = (value: unknown): ProposalDeliveryEvent[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is ProposalDeliveryEvent => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return false;
      }
      const candidate = entry as Record<string, unknown>;
      return typeof candidate.sentAt === "string";
    });
  };

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="py-6 pr-6">
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">{t('proposalDetail.notFound.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('proposalDetail.notFound.description')}</p>
          <Button className="mt-4" onClick={() => navigate("/proposals")}>
            {t('proposalDetail.notFound.backButton')}
          </Button>
        </div>
      </div>
    );
  }

  const proposalStatus = normalizeProposalStatus(proposal.status);
  const statusConfig = getStatusConfig(proposalStatus);
  const deliveryHistory = toDeliveryHistory(proposal.deliveryHistory);
  const canMarkAsSentManually =
    proposalStatus !== PROPOSAL_STATUSES.ACCEPTED &&
    proposalStatus !== PROPOSAL_STATUSES.INVOICED;
  const canMarkAsAccepted =
    proposalStatus === PROPOSAL_STATUSES.CREATED ||
    proposalStatus === PROPOSAL_STATUSES.SENT;

  // Extract client information
  const clientFormData =
    leadData?.formData &&
    typeof leadData.formData === "object" &&
    leadData.formData !== null
      ? (leadData.formData as Record<string, unknown>)
      : {};

  const formDataEntries = Object.entries(clientFormData);

  const findFormFieldString = (aliases: string[]): string => {
    const normalizedAliases = aliases.map(normalizeFieldKey);
    for (const [key, value] of formDataEntries) {
      if (!normalizedAliases.includes(normalizeFieldKey(key))) continue;
      const extracted = readStringValue(value);
      if (extracted) return extracted;
    }
    return "";
  };

  const clientFirstName =
    contactData?.firstName ||
    leadData?.firstName ||
    findFormFieldString(["firstName", "firstname", "first_name", "givenName", "given_name"]);
  const clientLastName =
    contactData?.lastName ||
    leadData?.lastName ||
    findFormFieldString(["lastName", "lastname", "last_name", "surname", "familyName", "family_name"]);
  // Also support formData.name as a combined full-name fallback (e.g. "Test Finalov")
  const clientFullName =
    [clientFirstName, clientLastName].filter(Boolean).join(" ") ||
    findFormFieldString(["name", "fullName", "fullname", "full_name", "clientName", "contactName"]);
  const clientEmail =
    contactData?.email ||
    leadData?.email ||
    findFormFieldString(["email", "emailAddress", "email_address", "contactEmail", "customerEmail", "workEmail"]);
  const clientPhone =
    contactData?.phone?.[0] ||
    leadData?.phone ||
    findFormFieldString(["phone", "phoneNumber", "phone_number", "mobile", "mobilePhone", "cellPhone"]);
  const clientCompany =
    contactData?.company ||
    leadData?.company ||
    findFormFieldString(["company", "companyName", "company_name", "business", "businessName"]);
  const clientJobTitle =
    contactData?.jobTitle ||
    leadData?.jobTitle ||
    findFormFieldString(["jobTitle", "job_title", "title", "position", "role"]);
  const clientAddress = contactData?.address;

  const seenSuggestedEmails = new Set<string>();
  const suggestedRecipientEmails: string[] = [];
  const addSuggestedRecipientEmail = (value: unknown) => {
    const stringValue = readStringValue(value);
    if (!stringValue || !isLikelyEmail(stringValue)) return;
    const normalized = stringValue.toLowerCase();
    if (seenSuggestedEmails.has(normalized)) return;
    seenSuggestedEmails.add(normalized);
    suggestedRecipientEmails.push(stringValue);
  };

  addSuggestedRecipientEmail(contactData?.email);
  addSuggestedRecipientEmail(leadData?.email);

  formDataEntries.forEach(([key, value]) => {
    if (normalizeFieldKey(key).includes("email")) {
      addSuggestedRecipientEmail(value);
    }
  });
  formDataEntries.forEach(([, value]) => {
    addSuggestedRecipientEmail(value);
  });

  const leadDataRows = flattenDataForDisplay(leadData)
    .filter((row) => !row.key.startsWith("formData") && row.key !== "organizationId")
    .sort((a, b) => a.key.localeCompare(b.key));
  const contactDataRows = flattenDataForDisplay(contactData)
    .filter((row) => row.key !== "organizationId")
    .sort((a, b) => a.key.localeCompare(b.key));
  const formDataRows = flattenDataForDisplay(clientFormData)
    .sort((a, b) => a.key.localeCompare(b.key));
  const hasClientSummaryData = Boolean(
    clientFullName ||
      clientEmail ||
      clientPhone ||
      clientCompany ||
      clientJobTitle ||
      (clientAddress && (clientAddress.street || clientAddress.city || clientAddress.state || clientAddress.zipCode || clientAddress.country)),
  );
  const hasClientAnyData =
    hasClientSummaryData ||
    Boolean(leadData?.message) ||
    contactDataRows.length > 0 ||
    leadDataRows.length > 0 ||
    formDataRows.length > 0;

  return (
    <div className="py-6 pr-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/proposals")} className="mt-1 shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('proposalDetail.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{proposal.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {t(`proposals.status.${proposalStatus}`)}
              </span>
              {proposal.createdAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {t('proposalDetail.created', { date: formatDateTable(proposal.createdAt) })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!proposal.invoiceId && (
            <Button onClick={() => setConvertDialogOpen(true)} size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              {t('proposalDetail.sections.convertToInvoice')}
            </Button>
          )}
          {proposal.invoiceId && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${proposal.invoiceId}`)}>
              <Receipt className="h-4 w-4 mr-2" />
              {t("proposalDetail.sections.viewInvoice")}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Incomplete Warning */}
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
            <p className="mt-2 text-sm">{t('proposalDetail.incomplete.reviewItems')}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Layout: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left column: proposal content */}
        <div className="lg:col-span-2 space-y-4">

          {/* Description */}
          {proposal.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('proposalDetail.sections.description')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{proposal.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Items */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('proposalDetail.sections.items')}</CardTitle>
                <CardDescription className="text-xs">
                  {proposal.items.length === 1
                    ? t('proposalDetail.sections.itemsCount', { count: proposal.items.length })
                    : t('proposalDetail.sections.itemsCountPlural', { count: proposal.items.length })}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {proposal.items.map((item, index) => {
                  const unitPriceDisplay = formatCurrency(item.unitPrice, proposal.currency);
                  const lineTotal = item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100);
                  const lineTotalDisplay = formatCurrency(lineTotal, proposal.currency);
                  console.log(typeof unitPriceDisplay)
                  return (
                    <div key={index} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.qty} × {unitPriceDisplay}
                          {(item.taxPct ?? 0) > 0 && (
                            <span className="ml-2 text-muted-foreground/70">{t('proposalDetail.labels.tax', { tax: item.taxPct })}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="font-semibold text-sm">
                          {lineTotalDisplay}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t bg-muted/20 px-6 py-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('proposalDetail.sections.subtotal')}</span>
                  <span>{formatCurrency(proposal.subtotal, proposal.currency)}</span>
                </div>
                {proposal.taxTotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('proposalDetail.sections.tax')}</span>
                    <span>{formatCurrency(proposal.taxTotal, proposal.currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold text-sm">{t('proposalDetail.sections.total')}</span>
                  <span className="text-lg font-bold">{formatCurrency(proposal.total, proposal.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms and Notes */}
          {(proposal.terms || proposal.notes) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('proposalDetail.sections.additionalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {proposal.terms && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t('proposalDetail.sections.paymentTerms')}
                    </h4>
                    <p className="text-sm leading-relaxed">{proposal.terms}</p>
                  </div>
                )}
                {proposal.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t('proposalDetail.sections.notes')}
                    </h4>
                    <p className="text-sm leading-relaxed">{proposal.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: sidebar */}
        <div className="space-y-4">

          {/* Proposal Meta */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('proposalDetail.sections.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('proposalDetail.sections.currency')}</span>
                <span className="font-medium">{proposal.currency}</span>
              </div>
              {proposal.leadId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('proposalDetail.sections.leadId')}</span>
                  <span className="font-mono text-xs text-muted-foreground">{proposal.leadId.slice(0, 8)}…</span>
                </div>
              )}
              {proposal.invoiceId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('proposalDetail.sections.invoiceId')}</span>
                  <button
                    onClick={() => navigate(`/invoices/${proposal.invoiceId}`)}
                    className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {proposal.invoiceId.slice(0, 8)}…
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Information */}
          {proposal.leadId && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {t('proposalDetail.sections.clientInfo')}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {leadData?.status && (
                      <Badge variant="outline" className="text-xs py-0 h-5">
                        {String(t(`leads.status.${leadData.status}`))}
                      </Badge>
                    )}
                    {leadData?.widgetType && (
                      <Badge variant="secondary" className="text-xs py-0 h-5 capitalize">
                        {String(t(`leads.widgetType.${leadData.widgetType}`))}
                      </Badge>
                    )}
                    {!leadData && contactData && (
                      <Badge variant="secondary" className="text-xs py-0 h-5">
                        {t("proposalDetail.sections.contactFallbackBadge", "Contact linked")}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isClientInfoLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : hasClientAnyData ? (
                  <div className="space-y-3">

                    {/* Name + job */}
                    {clientFullName && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{clientFullName}</p>
                          {clientJobTitle && (
                            <p className="text-xs text-muted-foreground">{String(clientJobTitle)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Company */}
                    {clientCompany && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">{String(clientCompany)}</p>
                      </div>
                    )}

                    {/* Email */}
                    {clientEmail && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <a
                          href={`mailto:${clientEmail}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                        >
                          {clientEmail}
                        </a>
                      </div>
                    )}

                    {/* Phone */}
                    {clientPhone && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <a
                          href={`tel:${String(clientPhone)}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {String(clientPhone)}
                        </a>
                      </div>
                    )}

                    {/* Address */}
                    {clientAddress && (clientAddress.street || clientAddress.city || clientAddress.country) && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          {clientAddress.street && <p>{clientAddress.street}</p>}
                          <p>
                            {[clientAddress.city, clientAddress.state, clientAddress.zipCode]
                              .filter(Boolean).join(", ")}
                          </p>
                          {clientAddress.country && <p>{clientAddress.country}</p>}
                        </div>
                      </div>
                    )}

                    {/* Social media */}
                    {contactData?.socialMedia && (
                      <div className="flex items-center gap-2 pt-1">
                        {contactData.socialMedia.linkedin && (
                          <a href={contactData.socialMedia.linkedin} target="_blank" rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        )}
                        {contactData.socialMedia.twitter && (
                          <a href={contactData.socialMedia.twitter} target="_blank" rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <Twitter className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        )}
                        {(contactData.socialMedia.facebook || contactData.socialMedia.instagram) && (
                          <a href={contactData.socialMedia.facebook || contactData.socialMedia.instagram} target="_blank" rel="noreferrer"
                            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {leadData?.tags && leadData.tags.length > 0 && (
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {leadData.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs py-0 px-2">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    {(() => {
                      const message = leadData?.message || clientFormData.message;
                      return message ? (
                        <div className="pt-3 border-t">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {t('proposalDetail.sections.message')}
                              </p>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {String(message)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {(contactDataRows.length > 0 || leadDataRows.length > 0 || formDataRows.length > 0) && (
                      <Collapsible
                        open={isCapturedClientDataOpen}
                        onOpenChange={setIsCapturedClientDataOpen}
                        className="pt-3 border-t"
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between px-0 h-7 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                          >
                            <span>{t("proposalDetail.sections.allCapturedData", "All Captured Client Data")}</span>
                            <ChevronRight
                              className={cn(
                                "h-3.5 w-3.5 transition-transform duration-200",
                                isCapturedClientDataOpen && "rotate-90",
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-2">
                          {contactDataRows.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                {t("proposalDetail.sections.contactRecordData", "Contact record")}
                              </p>
                              {contactDataRows.map((row) => (
                                <div key={`contact-${row.key}`} className="flex items-start justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground shrink-0">{formatFieldPath(row.key)}</span>
                                  <span className="font-medium text-right break-all">{row.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {leadDataRows.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                {t("proposalDetail.sections.leadRecordData", "Lead record")}
                              </p>
                              {leadDataRows.map((row) => (
                                <div key={`lead-${row.key}`} className="flex items-start justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground shrink-0">{formatFieldPath(row.key)}</span>
                                  <span className="font-medium text-right break-all">{row.value}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {formDataRows.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                                {t("proposalDetail.sections.submissionData", "Submission form fields")}
                              </p>
                              {formDataRows.map((row) => (
                                <div key={`form-${row.key}`} className="flex items-start justify-between gap-2 text-xs">
                                  <span className="text-muted-foreground shrink-0">{formatFieldPath(row.key)}</span>
                                  <span className="font-medium text-right break-all">{row.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('proposalDetail.sections.leadInfoNotAvailable')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Send Proposal Email */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {t("proposalDetail.email.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("proposalDetail.email.recipientLabel")}
                </Label>
                <Input
                  type="email"
                  value={proposalRecipientEmail}
                  onChange={(e) => setProposalRecipientEmail(e.target.value)}
                  placeholder={t("proposalDetail.email.recipientPlaceholder")}
                  className="h-9"
                />
                {suggestedRecipientEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "proposalDetail.email.suggestedRecipientHint",
                        "Suggested from lead/widget submission. Click to use:",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedRecipientEmails.map((email) => {
                        const isActive =
                          proposalRecipientEmail.trim().toLowerCase() === email.toLowerCase();

                        return (
                          <Button
                            key={email}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 px-2 text-xs border transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                                : "bg-primary/5 text-black border-primary/25 hover:bg-primary/10",
                            )}
                            onClick={() => {
                              if (isActive) {
                                setProposalRecipientEmail("");
                                return;
                              }
                              setProposalRecipientEmail(email);
                            }}
                          >
                            <span className="truncate max-w-[220px]">{email}</span>
                            {isActive && <X className="h-3 w-3 ml-1 shrink-0" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("proposalDetail.email.templateLabel")}
                </Label>
                {isEmailTemplatesLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={selectedProposalEmailTemplateId} onValueChange={setSelectedProposalEmailTemplateId}>
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={t("proposalDetail.email.templatePlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t("proposalDetail.email.defaultTemplate")}
                      </SelectItem>
                      {compatibleProposalEmailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name || template.id}
                        </SelectItem>
                      ))}
                      {compatibleProposalEmailTemplates.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          {t("proposalDetail.email.noCompatibleTemplates")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                onClick={handleSendProposalEmail}
                className="w-full h-9"
                disabled={sendProposalEmail.isPending || !proposalRecipientEmail.trim()}
              >
                {sendProposalEmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("proposalDetail.email.sending")}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    {t("proposalDetail.email.send")}
                  </>
                )}
              </Button>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9"
                  disabled={!canMarkAsSentManually || updateProposal.isPending}
                  onClick={async () => {
                    if (!proposal) return;
                    try {
                      const manualEvent: ProposalDeliveryEvent = {
                        method: "manual",
                        channel: "manual",
                        recipient: proposalRecipientEmail.trim() || undefined,
                        sentAt: new Date().toISOString(),
                        details: {
                          source: "manual_mark_sent",
                        },
                      };
                      await updateProposal.mutateAsync({
                        id: proposal.id,
                        data: {
                          status: PROPOSAL_STATUSES.SENT,
                          deliveryHistory: [...deliveryHistory, manualEvent],
                        },
                      });
                      toast.success(t("proposalDetail.email.manualMarkedSent"));
                    } catch (error) {
                      toast.error(
                        t("proposalDetail.email.manualMarkSentFailed", {
                          error: error instanceof Error ? error.message : t("proposalDetail.review.unknownError"),
                        }),
                      );
                    }
                  }}
                >
                  {t("proposalDetail.email.markSentManually")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-9"
                  disabled={!canMarkAsAccepted || updateProposal.isPending}
                  onClick={async () => {
                    if (!proposal) return;
                    try {
                      await updateProposal.mutateAsync({
                        id: proposal.id,
                        data: {
                          status: PROPOSAL_STATUSES.ACCEPTED,
                        },
                      });
                      toast.success(t("proposalDetail.email.markedAccepted"));
                    } catch (error) {
                      toast.error(
                        t("proposalDetail.email.markAcceptedFailed", {
                          error: error instanceof Error ? error.message : t("proposalDetail.review.unknownError"),
                        }),
                      );
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("proposalDetail.email.markAccepted")}
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("proposalDetail.email.deliveryHistory")}
                </Label>
                {deliveryHistory.length > 0 ? (
                  <div className="space-y-1.5 rounded-md border p-2 max-h-36 overflow-y-auto">
                    {deliveryHistory
                      .slice()
                      .reverse()
                      .map((event, index) => (
                        <div key={`${event.sentAt}-${index}`} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {event.method === "manual" ? t("proposalDetail.email.methodManual") : t("proposalDetail.email.methodEmail")}
                          </span>
                          {" · "}
                          {event.recipient || t("proposalDetail.email.noRecipient")}
                          {" · "}
                          {formatDateTable(event.sentAt)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("proposalDetail.email.noDeliveryHistory")}</p>
                )}
              </div>
            </CardContent>
          </Card>
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
            <DialogDescription>{t('proposalDetail.convert.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('proposalDetail.convert.templateLabel')}</Label>
              {isTemplatesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
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
              {templates && templates.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('proposalDetail.convert.noTemplates')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={generateInvoice.isPending}>
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
                  const result = await generateInvoice.mutateAsync({
                    proposalId: proposal.id,
                    templateId: selectedTemplateId,
                    organizationId: currentOrganization.id,
                  });
                  setGeneratedInvoiceData({
                    ...result,
                    invoiceData: result.invoiceData as Record<string, InvoiceDataValue>,
                  });
                  setConvertDialogOpen(false);
                  setReviewDialogOpen(true);
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : t("proposalDetail.review.unknownError");
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
            <DialogDescription>{t('proposalDetail.review.description')}</DialogDescription>
          </DialogHeader>

          {generatedInvoiceData && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Invoice Number */}
                {generatedInvoiceData.invoiceNumber && (
                  <div className="space-y-2">
                    <Label>{t('proposalDetail.review.invoiceNumber')}</Label>
                    <Input value={generatedInvoiceData.invoiceNumber} readOnly className="bg-muted" />
                  </div>
                )}

                {/* Seller Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.sellerInfo')}</h3>
                  {(() => {
                    const selectedTemplate = templates?.find(t => t.id === generatedInvoiceData.templateId);
                    if (!selectedTemplate) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {t("proposalDetail.review.templateNotFound")}
                        </p>
                      );
                    }

                    const allBindings = extractTemplateBindings(selectedTemplate.elements ?? []);
                    const sellerBindings = Array.from(allBindings).filter(binding =>
                      binding.startsWith("seller.") || binding.startsWith("supplier.")
                    );
                    if (sellerBindings.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {t("proposalDetail.review.noSellerFields")}
                        </p>
                      );
                    }

                    const fieldGroups = new Map<string, string[]>();
                    const simpleFields: string[] = [];

                    sellerBindings.forEach(binding => {
                      const parts = binding.split(".");
                      if (parts.length === 2) {
                        simpleFields.push(binding);
                      } else if (parts.length > 2) {
                        const basePath = parts.slice(0, -1).join(".");
                        const fieldName = parts[parts.length - 1];
                        if (!fieldGroups.has(basePath)) fieldGroups.set(basePath, []);
                        fieldGroups.get(basePath)!.push(fieldName);
                      }
                    });

                    simpleFields.forEach(binding => {
                      const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        const obj = value as Record<string, unknown>;
                        const fieldNames = Object.keys(obj);
                        const nestedBindings = sellerBindings.filter(b => b.startsWith(`${binding}.`) && b.length > binding.length + 1);
                        const nestedFieldNames = nestedBindings.map(b => b.split(".").pop() || "").filter(Boolean);
                        const isAddressField = binding.includes("address");
                        const standardAddressFields = ["street", "city", "state", "zipCode", "country", "full"];
                        let allFieldNames = Array.from(new Set([...fieldNames, ...nestedFieldNames]));
                        if (isAddressField) allFieldNames = Array.from(new Set([...allFieldNames, ...standardAddressFields]));
                        if (allFieldNames.length > 0) {
                          const index = simpleFields.indexOf(binding);
                          if (index > -1) simpleFields.splice(index, 1);
                          if (fieldGroups.has(binding)) {
                            fieldGroups.set(binding, Array.from(new Set([...fieldGroups.get(binding)!, ...allFieldNames])));
                          } else {
                            fieldGroups.set(binding, allFieldNames);
                          }
                        }
                      }
                    });

                    sellerBindings.forEach(binding => {
                      const parts = binding.split(".");
                      if (parts.length === 2 && parts[1] === "address" && !fieldGroups.has(binding)) {
                        const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                        if (!value || typeof value !== "object" || Array.isArray(value)) {
                          fieldGroups.set(binding, ["street", "city", "state", "zipCode", "country", "full"]);
                          const index = simpleFields.indexOf(binding);
                          if (index > -1) simpleFields.splice(index, 1);
                        }
                      }
                    });

                    return (
                      <>
                        {simpleFields.map((binding) => {
                          const fieldName = binding.split(".").pop() || binding;
                          const label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, " $1");
                          const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                          if (typeof value === "object" && value !== null && !Array.isArray(value)) return null;
                          return (
                            <div key={binding} className="space-y-2">
                              <Label>{label}</Label>
                              <Input
                                value={String(value || "")}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newData = { ...generatedInvoiceData.invoiceData };
                                  setBindingValue(newData, binding, e.target.value);
                                  setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                }}
                                placeholder={t("proposalDetail.review.enterField", {
                                  field: label.toLowerCase(),
                                })}
                              />
                            </div>
                          );
                        })}
                        {Array.from(fieldGroups.entries()).map(([basePath, fields]) => {
                          const groupLabel = basePath.split(".").pop() || basePath;
                          const displayLabel = groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1).replace(/([A-Z])/g, " $1");
                          const groupValue = getBindingValue(generatedInvoiceData.invoiceData, basePath);
                          const groupObj = (typeof groupValue === "object" && groupValue !== null ? groupValue as Record<string, unknown> : {}) || {};
                          return (
                            <div key={basePath} className="space-y-2">
                              <Label>{displayLabel}</Label>
                              <div className="space-y-2">
                                {fields.map((fieldName) => {
                                  const fullBinding = `${basePath}.${fieldName}`;
                                  const fieldValue = groupObj[fieldName] || "";
                                  const fieldLabel =
                                    fieldName === "zipCode"
                                      ? t("proposalDetail.review.zipCode")
                                      : fieldName
                                          .charAt(0)
                                          .toUpperCase() +
                                        fieldName.slice(1).replace(/([A-Z])/g, " $1");
                                  return (
                                    <Input
                                      key={fullBinding}
                                      value={String(fieldValue || "")}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const newData = { ...generatedInvoiceData.invoiceData };
                                        const currentGroup = (getBindingValue(newData, basePath) as Record<string, unknown>) || {};
                                        setBindingValue(newData, basePath, { ...currentGroup, [fieldName]: e.target.value } as InvoiceDataValue);
                                        setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                      }}
                                      placeholder={t("proposalDetail.review.enterField", {
                                        field: fieldLabel.toLowerCase(),
                                      })}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>

                <Separator />

                {/* Customer Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.customerInfo')}</h3>
                  {(() => {
                    const selectedTemplate = templates?.find(t => t.id === generatedInvoiceData.templateId);
                    if (!selectedTemplate) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {t("proposalDetail.review.templateNotFound")}
                        </p>
                      );
                    }

                    const allBindings = extractTemplateBindings(selectedTemplate.elements ?? []);
                    const customerBindings = Array.from(allBindings).filter(binding =>
                      binding.startsWith("customer.") || binding.startsWith("buyer.")
                    );
                    if (customerBindings.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {t("proposalDetail.review.noCustomerFields")}
                        </p>
                      );
                    }

                    const fieldGroups = new Map<string, string[]>();
                    const simpleFields: string[] = [];

                    customerBindings.forEach(binding => {
                      const parts = binding.split(".");
                      if (parts.length === 2) {
                        simpleFields.push(binding);
                      } else if (parts.length > 2) {
                        const basePath = parts.slice(0, -1).join(".");
                        const fieldName = parts[parts.length - 1];
                        if (!fieldGroups.has(basePath)) fieldGroups.set(basePath, []);
                        fieldGroups.get(basePath)!.push(fieldName);
                      }
                    });

                    simpleFields.forEach(binding => {
                      const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        const obj = value as Record<string, unknown>;
                        const fieldNames = Object.keys(obj);
                        const nestedBindings = customerBindings.filter(b => b.startsWith(`${binding}.`) && b.length > binding.length + 1);
                        const nestedFieldNames = nestedBindings.map(b => b.split(".").pop() || "").filter(Boolean);
                        const isAddressField = binding.includes("address");
                        const standardAddressFields = ["street", "city", "state", "zipCode", "country", "full"];
                        let allFieldNames = Array.from(new Set([...fieldNames, ...nestedFieldNames]));
                        if (isAddressField) allFieldNames = Array.from(new Set([...allFieldNames, ...standardAddressFields]));
                        if (allFieldNames.length > 0) {
                          const index = simpleFields.indexOf(binding);
                          if (index > -1) simpleFields.splice(index, 1);
                          if (fieldGroups.has(binding)) {
                            fieldGroups.set(binding, Array.from(new Set([...fieldGroups.get(binding)!, ...allFieldNames])));
                          } else {
                            fieldGroups.set(binding, allFieldNames);
                          }
                        }
                      }
                    });

                    customerBindings.forEach(binding => {
                      const parts = binding.split(".");
                      if (parts.length === 2 && parts[1] === "address" && !fieldGroups.has(binding)) {
                        const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                        if (!value || typeof value !== "object" || Array.isArray(value)) {
                          fieldGroups.set(binding, ["street", "city", "state", "zipCode", "country", "full"]);
                          const index = simpleFields.indexOf(binding);
                          if (index > -1) simpleFields.splice(index, 1);
                        }
                      }
                    });

                    return (
                      <>
                        {simpleFields.map((binding) => {
                          const fieldName = binding.split(".").pop() || binding;
                          const label = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, " $1");
                          const value = getBindingValue(generatedInvoiceData.invoiceData, binding);
                          if (typeof value === "object" && value !== null && !Array.isArray(value)) return null;
                          return (
                            <div key={binding} className="space-y-2">
                              <Label>{label}</Label>
                              <Input
                                value={String(value || "")}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newData = { ...generatedInvoiceData.invoiceData };
                                  setBindingValue(newData, binding, e.target.value);
                                  setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                }}
                                placeholder={t("proposalDetail.review.enterField", {
                                  field: label.toLowerCase(),
                                })}
                              />
                            </div>
                          );
                        })}
                        {Array.from(fieldGroups.entries()).map(([basePath, fields]) => {
                          const groupLabel = basePath.split(".").pop() || basePath;
                          const displayLabel = groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1).replace(/([A-Z])/g, " $1");
                          const groupValue = getBindingValue(generatedInvoiceData.invoiceData, basePath);
                          const groupObj = (typeof groupValue === "object" && groupValue !== null ? groupValue as Record<string, unknown> : {}) || {};
                          return (
                            <div key={basePath} className="space-y-2">
                              <Label>{displayLabel}</Label>
                              <div className="space-y-2">
                                {fields.map((fieldName) => {
                                  const fullBinding = `${basePath}.${fieldName}`;
                                  const fieldValue = groupObj[fieldName] || "";
                                  const fieldLabel =
                                    fieldName === "zipCode"
                                      ? t("proposalDetail.review.zipCode")
                                      : fieldName
                                          .charAt(0)
                                          .toUpperCase() +
                                        fieldName.slice(1).replace(/([A-Z])/g, " $1");
                                  return (
                                    <Input
                                      key={fullBinding}
                                      value={String(fieldValue || "")}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const newData = { ...generatedInvoiceData.invoiceData };
                                        const currentGroup = (getBindingValue(newData, basePath) as Record<string, unknown>) || {};
                                        setBindingValue(newData, basePath, { ...currentGroup, [fieldName]: e.target.value } as InvoiceDataValue);
                                        setGeneratedInvoiceData({ ...generatedInvoiceData, invoiceData: newData });
                                      }}
                                      placeholder={t("proposalDetail.review.enterField", {
                                        field: fieldLabel.toLowerCase(),
                                      })}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>

                <Separator />

                {/* Invoice Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.invoiceDetails')}</h3>
                  {(() => {
                    const invoiceDetailLabels: Record<string, string> = {
                      invoiceNumber: t("proposalDetail.review.invoiceDetailsFields.invoiceNumber"),
                      invoiceDate: t("proposalDetail.review.invoiceDetailsFields.invoiceDate"),
                      issueDate: t("proposalDetail.review.invoiceDetailsFields.issueDate"),
                      dueDate: t("proposalDetail.review.invoiceDetailsFields.dueDate"),
                      currency: t("proposalDetail.review.invoiceDetailsFields.currency"),
                    };
                    return ["invoiceNumber", "invoiceDate", "issueDate", "dueDate", "currency"].map((key) => {
                      const value = generatedInvoiceData.invoiceData[key];
                      if (value === undefined) return null;
                      const label =
                        invoiceDetailLabels[key] ||
                        key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1");
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
                    });
                  })()}
                </div>

                <Separator />

                {/* Items */}
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
                            {(generatedInvoiceData.invoiceData.items as Array<Record<string, unknown>>).map((item, idx) => {
                              const quantityRaw = item.qty ?? item.quantity ?? 0;
                              const unitPriceRaw = item.unitPrice ?? item.price ?? 0;
                              const quantity = Number(quantityRaw);
                              const unitPrice = Number(unitPriceRaw);
                              const lineTotalRaw =
                                item.total ??
                                item.amount ??
                                (Number.isFinite(quantity) && Number.isFinite(unitPrice)
                                  ? quantity * unitPrice
                                  : 0);
                              const reviewCurrency =
                                typeof generatedInvoiceData.invoiceData.currency === "string"
                                  ? generatedInvoiceData.invoiceData.currency
                                  : proposal.currency;

                              return (
                                <tr key={idx} className="border-t">
                                  <td className="p-2">{String(item.description || "")}</td>
                                  <td className="p-2 text-right">{Number.isFinite(quantity) ? quantity : String(quantityRaw || "")}</td>
                                  <td className="p-2 text-right">{formatCurrency(unitPriceRaw, reviewCurrency)}</td>
                                  <td className="p-2 text-right">{formatCurrency(lineTotalRaw, reviewCurrency)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('proposalDetail.review.itemsEditable')}</p>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{t('proposalDetail.review.totals')}</h3>
                  {(() => {
                    const totalsLabels: Record<string, string> = {
                      subtotal: t("proposalDetail.review.totalsFields.subtotal"),
                      netAmount: t("proposalDetail.review.totalsFields.netAmount"),
                      taxTotal: t("proposalDetail.review.totalsFields.taxTotal"),
                      vatTotal: t("proposalDetail.review.totalsFields.vatTotal"),
                      total: t("proposalDetail.review.totalsFields.total"),
                      grossTotal: t("proposalDetail.review.totalsFields.grossTotal"),
                    };
                    return ["subtotal", "netAmount", "taxTotal", "vatTotal", "total", "grossTotal"].map((key) => {
                      const value = generatedInvoiceData.invoiceData[key];
                      if (value === undefined) return null;
                      const label =
                        totalsLabels[key] ||
                        key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1");
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
                    });
                  })()}
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
                    status: "unsent",
                  });
                  toast.success(t('proposalDetail.review.createSuccess'));
                  setReviewDialogOpen(false);
                  setGeneratedInvoiceData(null);
                  if (proposal) {
                    try {
                      await updateProposal.mutateAsync({
                        id: proposal.id,
                        data: {
                          invoiceId: result.id,
                          status: PROPOSAL_STATUSES.INVOICED,
                        },
                      });
                    } catch (error) {
                      console.warn("Failed to link proposal to invoice:", error);
                    }
                  }
                  navigate(`/invoices/${result.id}`);
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : t("proposalDetail.review.unknownError");
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

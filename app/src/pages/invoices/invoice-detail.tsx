import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { Link as LinkIcon, Send, Loader2, Copy, Check, Eye } from "lucide-react";
import { useRenderInvoicePdf, useSendInvoiceEmail, useGenerateInvoiceShareLink, usePreviewInvoiceEmail } from "@/hooks";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateInvoice } from "@/hooks/repository-hooks/use-invoices";
import {
    INVOICE_STATUSES,
    normalizeInvoiceStatus,
    type InvoiceDeliveryEvent,
} from "@/core/entities/invoice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmailTemplateSelector } from "@/components/email-template/email-template-selector";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);

type InvoiceEmailPreview = {
    previewId: string;
    subject: string;
    html: string;
    text: string;
    toEmail: string;
    expiresAt: string;
    emailTemplateId: string;
};

export default function InvoiceDetailPage() {
    const { t } = useTranslation();
    const { id = "" } = useParams();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string | undefined>(undefined);
    const [emailPreview, setEmailPreview] = useState<InvoiceEmailPreview | null>(null);
    const [isEmailPreviewDialogOpen, setIsEmailPreviewDialogOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>(INVOICE_STATUSES.UNSENT);

    const { data: currentOrg } = useCurrentOrganization();
    const updateInvoice = useUpdateInvoice();

    const { data: invoice } = useQuery({
        queryKey: ["invoices", id],
        queryFn: () => invoiceRepository.get({ id }),
        enabled: !!id,
    });

    const renderPdf = useRenderInvoicePdf();
    const sendEmail = useSendInvoiceEmail();
    const generateShareLink = useGenerateInvoiceShareLink();
    const previewEmail = usePreviewInvoiceEmail();

    useEffect(() => {
        if (!invoice) return;
        setSelectedStatus(normalizeInvoiceStatus(invoice.status));
    }, [invoice?.id, invoice?.status]);

    // Automatically load preview when invoice is available
    useEffect(() => {
        if (invoice && !previewUrl && !renderPdf.isPending) {
        renderPdf.mutate(
            { invoiceId: invoice.id },
            {
                onSuccess: (result) => {
                    setPreviewUrl(result.url);
                },
                onError: (error) => {
                    toast.error(t('invoiceDetail.messages.previewFailed', { error: error.message }));
                },
            }
        );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice?.id, t]);

    useEffect(() => {
        if (!invoice || email.trim()) return;
        const invoiceData = invoice.data as Record<string, unknown>;
        const buyer = (invoiceData.buyer || invoiceData.customer) as Record<string, unknown> | undefined;
        const defaultEmail = typeof buyer?.email === "string" ? buyer.email.trim() : "";
        if (defaultEmail) {
            setEmail(defaultEmail);
        }
    }, [invoice, email]);

    const handleGenerateEmailPreview = useCallback((recipientOverride?: string, options?: { openDialog?: boolean }) => {
        if (!invoice || !selectedEmailTemplateId) return;

        previewEmail.mutate(
            {
                invoiceId: invoice.id,
                emailTemplateId: selectedEmailTemplateId,
                toEmail: recipientOverride?.trim() || undefined,
            },
            {
                onSuccess: (result) => {
                    setEmailPreview({
                        ...result,
                        emailTemplateId: selectedEmailTemplateId,
                    });
                    if (!email.trim()) {
                        setEmail(result.toEmail);
                    }
                    if (options?.openDialog) {
                        setIsEmailPreviewDialogOpen(true);
                    }
                },
                onError: (error) => {
                    setEmailPreview(null);
                    toast.error(
                        t("invoiceDetail.email.previewLoadFailed", "Failed to generate email preview: {{error}}", {
                            error: error.message,
                        }),
                    );
                },
            },
        );
    }, [invoice, previewEmail, selectedEmailTemplateId, t]);

    useEffect(() => {
        if (!invoice || !selectedEmailTemplateId) {
            setEmailPreview(null);
            return;
        }
        handleGenerateEmailPreview(email.trim() || undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice?.id, selectedEmailTemplateId]);

    const previewIsExpired = useMemo(() => {
        if (!emailPreview?.expiresAt) return true;
        const expiresAtMs = Date.parse(emailPreview.expiresAt);
        if (Number.isNaN(expiresAtMs)) return true;
        return expiresAtMs <= Date.now();
    }, [emailPreview]);

    const previewMatchesSelection = useMemo(() => {
        if (!emailPreview || !selectedEmailTemplateId) return false;
        if (emailPreview.emailTemplateId !== selectedEmailTemplateId) return false;
        const normalizedRecipient = email.trim().toLowerCase();
        const normalizedPreviewRecipient = emailPreview.toEmail.trim().toLowerCase();
        return normalizedRecipient.length > 0 && normalizedRecipient === normalizedPreviewRecipient;
    }, [email, emailPreview, selectedEmailTemplateId]);

    const canSendEmail = Boolean(
        email &&
            selectedEmailTemplateId &&
            emailPreview &&
            previewMatchesSelection &&
            !previewIsExpired &&
            !sendEmail.isPending,
    );

    const handleSendEmail = () => {
        if (!invoice || !email || !selectedEmailTemplateId || !emailPreview) return;
        
        sendEmail.mutate(
            { 
                invoiceId: invoice.id, 
                toEmail: email,
                emailTemplateId: selectedEmailTemplateId,
                previewId: emailPreview.previewId,
            },
            {
                onSuccess: () => {
                    toast.success(t('invoiceDetail.email.sent', { email }));
                    setEmail("");
                    setEmailPreview(null);
                },
                onError: (error) => {
                    toast.error(t('invoiceDetail.email.sendFailed', { error: error.message }));
                },
            }
        );
    };

    const toDeliveryHistory = (value: unknown): InvoiceDeliveryEvent[] => {
        if (!Array.isArray(value)) return [];
        return value.filter((entry): entry is InvoiceDeliveryEvent => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
                return false;
            }
            const candidate = entry as Record<string, unknown>;
            return typeof candidate.sentAt === "string";
        });
    };

    const deliveryHistory = useMemo(
        () => toDeliveryHistory((invoice as unknown as { deliveryHistory?: unknown })?.deliveryHistory),
        [invoice],
    );

    const handleGenerateShareLink = () => {
        if (!invoice) return;
        
        generateShareLink.mutate(
            { invoiceId: invoice.id },
            {
                onSuccess: (result) => {
                    setShareLink(result.url);
                },
                onError: (error) => {
                    toast.error(t('invoiceDetail.share.generateFailed', { error: error.message }));
                },
            }
        );
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;
        
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            toast.success(t('invoiceDetail.share.linkCopied'));
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(t('invoiceDetail.share.copyFailed'));
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('invoiceDetail.title', { id })}</h1>
                <p className="text-muted-foreground">{t('invoiceDetail.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card className="card-large">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{t('invoiceDetail.preview.title')}</CardTitle>
                                <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={handleGenerateShareLink}
                                    disabled={generateShareLink.isPending}
                                        size="sm"
                                >
                                    <LinkIcon className="mr-2 h-4 w-4" /> 
                                        {generateShareLink.isPending ? t('invoiceDetail.share.generating') : t('invoiceDetail.share.button')}
                                </Button>
                                </div>
                            </div>
                            {shareLink && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-md">
                                    <Input
                                        value={shareLink}
                                        readOnly
                                        className="flex-1 font-mono text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyLink}
                                        className="shrink-0"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="mr-2 h-4 w-4" />
                                                {t('invoiceDetail.share.copied')}
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="mr-2 h-4 w-4" />
                                                {t('invoiceDetail.share.copy')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {renderPdf.isPending ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">{t('invoiceDetail.preview.generating')}</p>
                                </div>
                            ) : previewUrl ? (
                                <div className="aspect-[1/1.414] w-full overflow-hidden rounded border bg-muted">
                                    <iframe 
                                        title="invoice-preview" 
                                        src={previewUrl} 
                                        className="h-full w-full border-0" 
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <p className="text-muted-foreground">{t('invoiceDetail.preview.loadFailed')}</p>
                                    <Button 
                                        className="btn-primary mt-4" 
                                        onClick={() => {
                                            if (invoice) {
                                                renderPdf.mutate(
                                                    { invoiceId: invoice.id },
                                                    {
                                                        onSuccess: (result) => {
                                                            setPreviewUrl(result.url);
                                                        },
                                                        onError: (error) => {
                                                            toast.error(t('invoiceDetail.messages.previewFailed', { error: error.message }));
                                                        },
                                                    }
                                                );
                                            }
                                        }}
                                    >
                                        {t('invoiceDetail.preview.retry')}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card className="card-large mb-4">
                        <CardHeader>
                            <CardTitle>{t("invoiceDetail.status.title", "Invoice status")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                <Label>{t("invoiceDetail.status.label", "Status")}</Label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={INVOICE_STATUSES.UNSENT}>{t("invoiceDetail.status.unsent", "Unsent")}</SelectItem>
                                        <SelectItem value={INVOICE_STATUSES.SENT}>{t("invoiceDetail.status.sent", "Sent")}</SelectItem>
                                        <SelectItem value={INVOICE_STATUSES.PAID}>{t("invoiceDetail.status.paid", "Paid")}</SelectItem>
                                        <SelectItem value={INVOICE_STATUSES.CANCELLED}>{t("invoiceDetail.status.cancelled", "Cancelled")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                disabled={!invoice || updateInvoice.isPending || selectedStatus === normalizeInvoiceStatus(invoice.status)}
                                onClick={async () => {
                                    if (!invoice) return;
                                    try {
                                        const currentStatus = normalizeInvoiceStatus(invoice.status);
                                        const shouldAppendManualSendEvent =
                                            selectedStatus === INVOICE_STATUSES.SENT &&
                                            currentStatus !== INVOICE_STATUSES.SENT;
                                        const updateData: {
                                            status: "unsent" | "sent" | "paid" | "cancelled";
                                            deliveryHistory?: InvoiceDeliveryEvent[];
                                        } = {
                                            status: selectedStatus as "unsent" | "sent" | "paid" | "cancelled",
                                        };

                                        if (shouldAppendManualSendEvent) {
                                            const manualEvent: InvoiceDeliveryEvent = {
                                                method: "manual",
                                                channel: "manual",
                                                recipient: email.trim() || undefined,
                                                sentAt: new Date().toISOString(),
                                                details: {
                                                    source: "manual_mark_sent",
                                                },
                                            };
                                            updateData.deliveryHistory = [...deliveryHistory, manualEvent];
                                        }

                                        await updateInvoice.mutateAsync({
                                            id: invoice.id,
                                            data: updateData,
                                        });
                                        toast.success(t("invoiceDetail.status.saved", "Invoice status updated"));
                                    } catch (error) {
                                        toast.error(
                                            t("invoiceDetail.status.saveFailed", "Failed to update invoice status: {{error}}", {
                                                error: error instanceof Error ? error.message : "Unknown error",
                                            }),
                                        );
                                    }
                                }}
                            >
                                {updateInvoice.isPending ? t("invoiceDetail.status.saving", "Saving...") : t("invoiceDetail.status.save", "Save status")}
                            </Button>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t("invoiceDetail.status.deliveryHistory", "Delivery history")}</Label>
                                {deliveryHistory.length > 0 ? (
                                    <div className="space-y-1.5 rounded-md border p-2 max-h-32 overflow-y-auto">
                                        {deliveryHistory
                                            .slice()
                                            .reverse()
                                            .map((event, index) => (
                                                <div key={`${event.sentAt}-${index}`} className="text-xs text-muted-foreground">
                                                    <span className="font-medium text-foreground">
                                                        {event.method === "manual"
                                                            ? t("invoiceDetail.status.methodManual", "Manual")
                                                            : t("invoiceDetail.status.methodEmail", "Email")}
                                                    </span>
                                                    {" · "}
                                                    {event.recipient || t("invoiceDetail.status.noRecipient", "No recipient")}
                                                    {" · "}
                                                    {new Date(event.sentAt).toLocaleString()}
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">{t("invoiceDetail.status.noDeliveryHistory", "No delivery history yet.")}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="card-large">
                        <CardHeader>
                            <CardTitle>{t('invoiceDetail.email.title')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('invoiceDetail.email.templateLabel', 'Email Template')}</Label>
                                {!invoice ? (
                                    <div className="text-sm text-muted-foreground">
                                        {t('invoiceDetail.email.loadingInvoice', 'Loading invoice...')}
                                    </div>
                                ) : !currentOrg ? (
                                    <div className="text-sm text-muted-foreground">
                                        {t('invoiceDetail.email.loadingOrg', 'Loading organization...')}
                                    </div>
                                ) : (
                                    <EmailTemplateSelector
                                        orgId={currentOrg.id}
                                        entityTemplateId={invoice.templateId}
                                        entityType="invoice"
                                        compatibilityContext="invoice_send"
                                        availableBindings={[]}
                                        selectedTemplateId={selectedEmailTemplateId}
                                        entityData={invoice.data}
                                        onTemplateChange={(templateId) => {
                                            setSelectedEmailTemplateId(templateId);
                                            setEmailPreview(null);
                                            setIsEmailPreviewDialogOpen(false);
                                        }}
                                    />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>{t('invoiceDetail.email.recipientLabel', 'Recipient Email')}</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder={t('invoiceDetail.email.placeholder')}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                    <Button 
                                        className="btn-primary" 
                                        onClick={handleSendEmail} 
                                        disabled={!canSendEmail}
                                    >
                                        <Send className="mr-2 h-4 w-4" /> 
                                        {sendEmail.isPending ? t('invoiceDetail.email.sending') : t('invoiceDetail.email.send')}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t("invoiceDetail.email.previewTitle", "Recipient Email Preview")}</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (!invoice) return;
                                            if (!selectedEmailTemplateId) {
                                                toast.error(
                                                    t(
                                                        "invoiceDetail.email.previewSelectTemplate",
                                                        "Select an email template to generate a recipient preview.",
                                                    ),
                                                );
                                                return;
                                            }

                                            const currentRecipient = email.trim().toLowerCase();
                                            const previewRecipient = emailPreview?.toEmail.trim().toLowerCase() ?? "";
                                            const recipientChanged =
                                                currentRecipient.length > 0 && previewRecipient !== currentRecipient;
                                            const templateChanged =
                                                !!emailPreview && emailPreview.emailTemplateId !== selectedEmailTemplateId;
                                            const shouldRegeneratePreview =
                                                !emailPreview || previewIsExpired || recipientChanged || templateChanged;

                                            if (!shouldRegeneratePreview) {
                                                setIsEmailPreviewDialogOpen(true);
                                                return;
                                            }

                                            handleGenerateEmailPreview(email.trim() || undefined, { openDialog: true });
                                        }}
                                        disabled={!invoice || previewEmail.isPending}
                                        title={t("invoiceDetail.email.previewOpen", "Open preview")}
                                        aria-label={t("invoiceDetail.email.previewOpen", "Open preview")}
                                    >
                                        {previewEmail.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>

                                {!selectedEmailTemplateId ? (
                                    <p className="text-xs text-muted-foreground">
                                        {t("invoiceDetail.email.previewSelectTemplate", "Select an email template to generate a recipient preview.")}
                                    </p>
                                ) : previewEmail.isPending ? (
                                    <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t("invoiceDetail.email.previewGenerating", "Generating exact send preview...")}
                                    </div>
                                ) : emailPreview ? (
                                    <div className="space-y-2 rounded-md border p-3">
                                        <div className="text-xs text-muted-foreground">
                                            {t("invoiceDetail.email.previewSubject", "Subject")}:{" "}
                                            <span className="font-medium text-foreground">{emailPreview.subject}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t("invoiceDetail.email.previewRecipient", "Preview for")}:{" "}
                                            <span className="font-medium text-foreground">{emailPreview.toEmail}</span>
                                        </div>
                                        {!previewMatchesSelection && (
                                            <p className="text-xs text-amber-600">
                                                {t(
                                                    "invoiceDetail.email.previewRecipientMismatch",
                                                    "Recipient changed after preview. Click the eye icon to regenerate preview before sending.",
                                                )}
                                            </p>
                                        )}
                                        {previewIsExpired && (
                                            <p className="text-xs text-amber-600">
                                                {t("invoiceDetail.email.previewExpired", "Preview expired. Click the eye icon to regenerate preview before sending.")}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        {t("invoiceDetail.email.previewMissing", "No preview generated yet.")}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isEmailPreviewDialogOpen} onOpenChange={setIsEmailPreviewDialogOpen}>
                <DialogContent className="h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-5xl !flex !flex-col">
                    <div className="shrink-0 border-b px-4 py-3">
                        <DialogTitle className="text-base">{t("invoiceDetail.email.previewDialogTitle", "Email preview")}</DialogTitle>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                            {emailPreview?.subject || t("invoiceDetail.email.previewMissing", "No preview generated yet.")}
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden bg-muted p-4">
                        {emailPreview ? (
                            <iframe
                                key={emailPreview.previewId}
                                title="invoice-email-preview-dialog"
                                sandbox=""
                                srcDoc={emailPreview.html}
                                className="block h-full w-full rounded border bg-white"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                {t("invoiceDetail.email.previewMissing", "No preview generated yet.")}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

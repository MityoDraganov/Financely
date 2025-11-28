import { useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { Link as LinkIcon, Send, Loader2, Copy, Check } from "lucide-react";
import { useRenderInvoicePdf, useSendInvoiceEmail, useGenerateInvoiceShareLink } from "@/hooks";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { toast } from "sonner";
import { EmailTemplateSelector } from "@/components/email-template/email-template-selector";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import type { TemplateElement } from "@/core";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);
const templateRepository = getTemplateRealtimeRepository();

export default function InvoiceDetailPage() {
    const { t } = useTranslation();
    const { id = "" } = useParams();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string | undefined>(undefined);

    const { data: currentOrg } = useCurrentOrganization();

    const { data: invoice } = useQuery({
        queryKey: ["invoices", id],
        queryFn: () => invoiceRepository.get({ id }),
        enabled: !!id,
    });

    // Fetch invoice template
    const { data: invoiceTemplate, error: invoiceTemplateError, isLoading: isLoadingTemplate } = useQuery({
        queryKey: ["templates", invoice?.templateId],
        queryFn: async () => {
            if (!invoice?.templateId) {
                console.log("[INVOICE-DETAIL] No templateId in invoice:", invoice);
                return null;
            }
            console.log("[INVOICE-DETAIL] Fetching template with ID:", invoice.templateId);
            try {
                const template = await templateRepository.get({ id: invoice.templateId });
                console.log("[INVOICE-DETAIL] Template fetched:", template);
                return template;
            } catch (error) {
                console.error("[INVOICE-DETAIL] Error fetching template:", error);
                throw error;
            }
        },
        enabled: !!invoice?.templateId,
    });

    console.log("[INVOICE-DETAIL] Invoice:", invoice);
    console.log("[INVOICE-DETAIL] Invoice templateId:", invoice?.templateId);
    console.log("[INVOICE-DETAIL] Invoice template:", invoiceTemplate);
    console.log("[INVOICE-DETAIL] Invoice template error:", invoiceTemplateError);
    console.log("[INVOICE-DETAIL] Is loading template:", isLoadingTemplate);

    // Extract bindings from invoice template
    const availableBindings = useMemo(() => {
        if (!invoiceTemplate?.elements) return [];

        const fields = new Map<string, { path: string; label: string; type: "text" | "number" | "date" }>();
        const elements = invoiceTemplate.elements;

        for (const element of elements) {
            let binding: string | undefined;
            let type: "text" | "number" | "date" = "text";

            if (element.type === "text") {
                const textEl = element as Extract<TemplateElement, { type: "text" }>;
                binding = textEl.binding;
            } else if (element.type === "input") {
                const inputEl = element as Extract<TemplateElement, { type: "input" }>;
                binding = inputEl.binding;
                type =
                    inputEl.variant === "number"
                        ? "number"
                        : inputEl.variant === "date"
                            ? "date"
                            : "text";
            } else if (element.type === "currency") {
                const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
                binding = currencyEl.binding;
                type = "number";
            } else if (element.type === "table") {
                const tableEl = element as Extract<TemplateElement, { type: "table" }>;
                if (tableEl.itemsBinding) {
                    // Add the items binding
                    if (!fields.has(tableEl.itemsBinding)) {
                        fields.set(tableEl.itemsBinding, {
                            path: tableEl.itemsBinding,
                            label: tableEl.itemsBinding
                                .split(".")
                                .pop()!
                                .replace(/([A-Z])/g, " $1")
                                .replace(/^./, (c) => c.toUpperCase()),
                            type: "text",
                        });
                    }
                    // Add column bindings with full path
                    tableEl.columns?.forEach((col) => {
                        if (col.binding) {
                            const fullPath = `${tableEl.itemsBinding}[*].${col.binding}`;
                            if (!fields.has(fullPath)) {
                                fields.set(fullPath, {
                                    path: fullPath,
                                    label: `${col.binding} (${tableEl.itemsBinding})`,
                                    type: col.type === "number" ? "number" : "text",
                                });
                            }
                        }
                    });
                }
                continue;
            }

            if (binding && !fields.has(binding)) {
                fields.set(binding, {
                    path: binding,
                    label: binding
                        .split(".")
                        .pop()!
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (c) => c.toUpperCase()),
                    type,
                });
            }
        }

        return Array.from(fields.values());
    }, [invoiceTemplate]);

    const renderPdf = useRenderInvoicePdf();
    const sendEmail = useSendInvoiceEmail();
    const generateShareLink = useGenerateInvoiceShareLink();

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

    const handleSendEmail = () => {
        if (!invoice || !email || !selectedEmailTemplateId) return;
        
        sendEmail.mutate(
            { 
                invoiceId: invoice.id, 
                toEmail: email,
                emailTemplateId: selectedEmailTemplateId,
            },
            {
                onSuccess: () => {
                    toast.success(t('invoiceDetail.email.sent', { email }));
                    setEmail("");
                },
                onError: (error) => {
                    toast.error(t('invoiceDetail.email.sendFailed', { error: error.message }));
                },
            }
        );
    };

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

    console.log("[INVOICE-DETAIL] Invoice template:", invoiceTemplate);
    console.log("[INVOICE-DETAIL] Current organization:", currentOrg);

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
                                ) : isLoadingTemplate ? (
                                    <div className="text-sm text-muted-foreground">
                                        {t('invoiceDetail.email.loadingTemplate', 'Loading template...')}
                                    </div>
                                ) : invoiceTemplateError ? (
                                    <div className="text-sm text-destructive">
                                        {t('invoiceDetail.email.templateError', 'Error loading template. Please refresh the page.')}
                                    </div>
                                ) : !invoiceTemplate ? (
                                    <div className="text-sm text-muted-foreground">
                                        {t('invoiceDetail.email.noTemplate', 'Template not found')}
                                    </div>
                                ) : (
                                    <EmailTemplateSelector
                                        orgId={currentOrg.id}
                                        entityTemplateId={invoice.templateId}
                                        entityType="invoice"
                                        availableBindings={availableBindings}
                                        selectedTemplateId={selectedEmailTemplateId}
                                        onTemplateChange={setSelectedEmailTemplateId}
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
                                        disabled={!email || sendEmail.isPending || !selectedEmailTemplateId}
                                    >
                                        <Send className="mr-2 h-4 w-4" /> 
                                        {sendEmail.isPending ? t('invoiceDetail.email.sending') : t('invoiceDetail.email.send')}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}











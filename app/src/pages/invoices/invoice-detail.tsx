import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { Link as LinkIcon, Send, Loader2, Copy, Check } from "lucide-react";
import { useRenderInvoicePdf, useSendInvoiceEmail, useGenerateInvoiceShareLink } from "@/hooks";
import { toast } from "sonner";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);

export default function InvoiceDetailPage() {
    const { id = "" } = useParams();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { data: invoice } = useQuery({
        queryKey: ["invoices", id],
        queryFn: () => invoiceRepository.get({ id }),
        enabled: !!id,
    });

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
                    toast.error(`Failed to generate preview: ${error.message}`);
                },
            }
        );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice?.id]);

    const handleSendEmail = () => {
        if (!invoice || !email) return;
        
        sendEmail.mutate(
            { invoiceId: invoice.id, toEmail: email },
            {
                onSuccess: () => {
                    toast.success(`Invoice sent to ${email}`);
                    setEmail("");
                },
                onError: (error) => {
                    toast.error(`Failed to send email: ${error.message}`);
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
                    toast.error(`Failed to generate link: ${error.message}`);
                },
            }
        );
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;
        
        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            toast.success("Link copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy link");
        }
    };


    return (
        <div className="container mx-auto py-8">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Invoice {id}</h1>
                <p className="text-muted-foreground">View, download, email, or share this invoice.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card className="card-large">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Invoice Preview</CardTitle>
                                <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={handleGenerateShareLink}
                                    disabled={generateShareLink.isPending}
                                        size="sm"
                                >
                                    <LinkIcon className="mr-2 h-4 w-4" /> 
                                        {generateShareLink.isPending ? "Generating..." : "Share"}
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
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="mr-2 h-4 w-4" />
                                                Copy
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
                                    <p className="text-muted-foreground">Generating invoice preview...</p>
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
                                    <p className="text-muted-foreground">Failed to load invoice preview</p>
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
                                                            toast.error(`Failed to generate preview: ${error.message}`);
                                                        },
                                                    }
                                                );
                                            }
                                        }}
                                    >
                                        Retry
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card className="card-large">
                        <CardHeader>
                            <CardTitle>Send via email</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-2">
                            <Input
                                placeholder="recipient@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button 
                                className="btn-primary" 
                                onClick={handleSendEmail} 
                                disabled={!email || sendEmail.isPending}
                            >
                                <Send className="mr-2 h-4 w-4" /> 
                                {sendEmail.isPending ? "Sending..." : "Send"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}











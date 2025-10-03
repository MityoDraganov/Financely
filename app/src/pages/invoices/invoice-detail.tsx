import { useParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { Download, Eye, Link as LinkIcon, Send } from "lucide-react";
import { useRenderInvoicePdf, useSendInvoiceEmail, useGenerateInvoiceShareLink } from "@/hooks";
import { toast } from "sonner";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);

export default function InvoiceDetailPage() {
    const { id = "" } = useParams();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");

    const { data: invoice } = useQuery({
        queryKey: ["invoices", id],
        queryFn: () => invoiceRepository.get({ id }),
        enabled: !!id,
    });

    const renderPdf = useRenderInvoicePdf();
    const sendEmail = useSendInvoiceEmail();
    const generateShareLink = useGenerateInvoiceShareLink();

    const handlePreview = () => {
        if (!invoice) return;
        
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
    };

    const handleDownload = () => {
        if (!invoice) return;
        
        renderPdf.mutate(
            { invoiceId: invoice.id },
            {
                onSuccess: (result) => {
                    window.open(result.url, "_blank");
                    toast.success("PDF generated successfully!");
                },
                onError: (error) => {
                    toast.error(`Failed to generate PDF: ${error.message}`);
                },
            }
        );
    };

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
                    navigator.clipboard.writeText(result.url);
                    toast.success("Share link copied to clipboard!");
                },
                onError: (error) => {
                    toast.error(`Failed to generate link: ${error.message}`);
                },
            }
        );
    };


    return (
        <div className="container mx-auto py-8">
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Invoice {invoice?.invoiceNumber ?? id}</h1>
                <p className="text-muted-foreground">View, download, email, or share this invoice.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card className="card-large">
                        <CardHeader>
                            <CardTitle>Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <Button 
                                    className="btn-secondary" 
                                    onClick={handlePreview}
                                    disabled={renderPdf.isPending}
                                >
                                    <Eye className="mr-2 h-4 w-4" /> 
                                    {renderPdf.isPending ? "Loading..." : "Preview"}
                                </Button>
                                <Button 
                                    className="btn-primary" 
                                    onClick={handleDownload}
                                    disabled={renderPdf.isPending}
                                >
                                    <Download className="mr-2 h-4 w-4" /> 
                                    {renderPdf.isPending ? "Generating..." : "Download PDF"}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={handleGenerateShareLink}
                                    disabled={generateShareLink.isPending}
                                >
                                    <LinkIcon className="mr-2 h-4 w-4" /> 
                                    {generateShareLink.isPending ? "Generating..." : "Copy share link"}
                                </Button>
                            </div>
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

            <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogTrigger asChild>
                    <span />
                </DialogTrigger>
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
        </div>
    );
}








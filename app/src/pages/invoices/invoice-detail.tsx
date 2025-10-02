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

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesReposity(databaseService);
const functionsService = serviceHost.getFunctionsService();

export default function InvoiceDetailPage() {
    const { id = "" } = useParams();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [email, setEmail] = useState<string>("");

    const { data: invoice } = useQuery({
        queryKey: ["invoices", id],
        queryFn: () => invoiceRepository.get({ id }),
        enabled: !!id,
    });

    async function handlePreview() {
        if (!invoice) return;
        // For now, use a stub templateVersionId or derive later
        const { url } = await functionsService.renderInvoicePdf({ templateVersionId: "latest", invoiceId: invoice.id });
        setPreviewUrl(url);
    }

    async function handleDownload() {
        if (!invoice) return;
        const { url } = await functionsService.renderInvoicePdf({ templateVersionId: "latest", invoiceId: invoice.id });
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice.invoiceNumber || invoice.id}.pdf`;
        a.rel = "noopener";
        a.target = "_blank";
        a.click();
    }

    async function handleSendEmail() {
        if (!invoice || !email) return;
        await functionsService.sendInvoiceEmail({ invoiceId: invoice.id, toEmail: email });
        setEmail("");
    }

    async function handleShareLink() {
        if (!invoice) return;
        const { url } = await functionsService.generateInvoiceShareLink({ invoiceId: invoice.id });
        await navigator.clipboard.writeText(url);
    }

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
                                <Button className="btn-secondary" onClick={handlePreview}>
                                    <Eye className="mr-2 h-4 w-4" /> Preview
                                </Button>
                                <Button className="btn-primary" onClick={handleDownload}>
                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                </Button>
                                <Button variant="outline" onClick={handleShareLink}>
                                    <LinkIcon className="mr-2 h-4 w-4" /> Copy share link
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
                            <Button className="btn-primary" onClick={handleSendEmail} disabled={!email}>
                                <Send className="mr-2 h-4 w-4" /> Send
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







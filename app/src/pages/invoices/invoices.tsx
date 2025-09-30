import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { serviceHost } from "@/services";

export default function InvoicesPage() {
    const navigate = useNavigate();
    const { data: invoices, isLoading, isError } = useInvoices();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const functionsService = serviceHost.getFunctionsService();

    const handleCreate = () => navigate("/create-invoice");

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#eafcff] to-white p-6 md:p-10 border border-custom">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-3 md:gap-4">
                        <div className="inline-flex items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                            <span className="h-2 w-2 rounded-full bg-[--accent-color]" />
                            Invoices
                        </div>
                        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">Your invoices</h1>
                        <p className="text-gray max-w-2xl">Review your invoices or create a new one.</p>
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
                <div className="text-sm text-red-500">Failed to load invoices. Please try again.</div>
            )}

            {!isLoading && !isError && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {(invoices ?? []).map((invoice) => (
                        <Card key={invoice.id} className="group cursor-pointer transition-colors hover:border-foreground/20" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between text-base">
                                    <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> {invoice.invoiceNumber}</span>
                                    <span className="text-sm text-muted-foreground">{new Date(invoice.issueDate).toLocaleDateString()}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Buyer</span><span className="font-medium truncate max-w-[60%] text-right">{invoice.buyer.name}</span></div>
                                <div className="flex items-center justify-between"><span className="text-muted-foreground">Total</span><span className="font-semibold">{invoice.total.toFixed(2)}</span></div>
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            functionsService
                                                .renderInvoicePdf({ templateVersionId: "latest", invoiceId: invoice.id })
                                                .then(({ url }) => setPreviewUrl(url));
                                        }}
                                    >
                                        Preview
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
                    ))}

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
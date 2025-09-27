import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useCreateInvoice } from "@/hooks/use-invoice";
import { invoiceDataSchema, type InvoiceData, type FunctionsService } from "@/core";
import { toast } from "sonner";

type CreateInvoiceParams = Parameters<FunctionsService["createInvoice"]>[0];

export default function CreateInvoicePage() {
    const form = useForm<InvoiceData>({
        resolver: zodResolver(invoiceDataSchema),
        defaultValues: {
            seller: { name: "", address: "", taxIdVat: "" },
            buyer: { name: "", address: "", taxIdVat: "" },
            invoiceNumber: "",
            issueDate: new Date().toISOString().slice(0, 10),
            dueDate: new Date().toISOString().slice(0, 10),
            items: [
                { description: "", qty: 1, unitPrice: 0 },
            ],
            paymentTerms: "Due on receipt",
            iban: "",
            subtotal: 0,
            vatTotal: 0,
            total: 0,
        },
        mode: "onBlur",
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });

    const mutation = useCreateInvoice();

    const [vatRatePct, setVatRatePct] = useState<number>(20);
    const values = form.watch();
    const subtotal = (values.items ?? []).reduce((acc, item) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.unitPrice || 0);
        return acc + qty * price;
    }, 0);
    const vatTotal = Math.max(0, subtotal * (vatRatePct / 100));
    const total = subtotal + vatTotal;

    useEffect(() => {
        form.setValue("subtotal", subtotal, { shouldValidate: false, shouldDirty: true });
        form.setValue("vatTotal", vatTotal, { shouldValidate: false, shouldDirty: true });
        form.setValue("total", total, { shouldValidate: false, shouldDirty: true });
    }, [subtotal, vatTotal, total, form]);

    function onSubmit(valuesToSubmit: InvoiceData) {
        const payload: CreateInvoiceParams = {
            seller: valuesToSubmit.seller,
            buyer: valuesToSubmit.buyer,
            invoiceNumber: valuesToSubmit.invoiceNumber,
            issueDate: valuesToSubmit.issueDate,
            dueDate: valuesToSubmit.dueDate,
            items: valuesToSubmit.items,
            paymentTerms: valuesToSubmit.paymentTerms,
            iban: valuesToSubmit.iban,
            vatRatePct: vatRatePct,
        };

        mutation.mutate(payload, {
            onSuccess: (id) => {
                toast.success("Invoice created", {
                    description: `Invoice ID: ${id}`,
                });
                form.reset();
            },
            onError: (err) => {
                toast.error("Failed to create invoice", {
                    description: err.message,
                });
            },
        });
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#eafcff] to-white p-6 md:p-10 border border-custom">
                <div className="flex flex-col gap-3 md:gap-4">
                    <div className="inline-flex items-center gap-2 self-start rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                        <span className="h-2 w-2 rounded-full bg-[--accent-color]" />
                        Create Invoice
                    </div>
                    <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
                        Craft a clear, trustworthy invoice
                    </h1>
                    <p className="text-gray max-w-2xl">
                        Use a clean, structured layout so clients can scan quickly. Your brand-first design ensures confidence at every step.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Seller</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="seller.name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Company name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Acme Ltd." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="seller.taxIdVat"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>VAT / Tax ID</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="BG123456789" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="seller.address"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Street, City, Country" rows={3} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Buyer</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="buyer.name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Client name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Client LLC" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="buyer.taxIdVat"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>VAT / Tax ID</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="BG987654321" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="buyer.address"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Address</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Street, City, Country" rows={3} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Invoice details</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <FormField
                                        control={form.control}
                                        name="invoiceNumber"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-1">
                                                <FormLabel>Invoice number</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="INV-2025-001" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="issueDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Issue date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="dueDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Due date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="paymentTerms"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Payment terms</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="Payment due within 14 days. Late fees may apply." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="iban"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>IBAN</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="DE89 3704 0044 0532 0130 00" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div>
                                        <Label htmlFor="vatRatePct">VAT rate (%)</Label>
                                        <Input
                                            id="vatRatePct"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.1"
                                            value={vatRatePct}
                                            onChange={(e) => setVatRatePct(Number(e.target.value))}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Items</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <div className="hidden grid-cols-12 gap-3 md:grid text-sm text-muted-foreground">
                                        <div className="col-span-6">Description</div>
                                        <div className="col-span-2">Qty</div>
                                        <div className="col-span-2">Unit price</div>
                                        <div className="col-span-2 text-right">Line total</div>
                                    </div>

                                    {fields.map((fieldItem, index) => (
                                        <div key={fieldItem.id} className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.description` as const}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-6">
                                                        <FormLabel className="md:hidden">Description</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Service or product description" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.qty` as const}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel className="md:hidden">Qty</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                inputMode="numeric"
                                                                min={0}
                                                                step="1"
                                                                value={field.value ?? 0}
                                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.unitPrice` as const}
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel className="md:hidden">Unit price</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="0.01"
                                                                min={0}
                                                                value={field.value ?? 0}
                                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2">
                                                <div className="text-right font-medium">
                                                    {(() => {
                                                        const item = form.getValues().items?.[index];
                                                        const qty = Number(item?.qty || 0);
                                                        const price = Number(item?.unitPrice || 0);
                                                        return (qty * price).toFixed(2);
                                                    })()}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => remove(index)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    <div>
                                        <Button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => append({ description: "", qty: 1, unitPrice: 0 })}
                                        >
                                            Add item
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex items-center justify-end gap-3">
                                <Button type="button" variant="secondary" className="btn-secondary">
                                    Preview
                                </Button>
                                <Button type="submit" className="btn-primary" disabled={mutation.isPending}>
                                    {mutation.isPending ? "Creating..." : "Create invoice"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>

                <div className="lg:col-span-1">
                    <Card className="sticky top-6 card-large">
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-medium">{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">VAT</span>
                                <span className="font-medium">{vatTotal.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between text-lg">
                                <span>Total</span>
                                <span className="font-semibold">{total.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Totals are calculated based on your items and VAT rate. These values help you preview the final amount before sending.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}



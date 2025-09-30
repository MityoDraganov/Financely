import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { Template, TemplateElement } from "@/core";
import { TemplatePreview } from "@/components/templates/template-preview";
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
    const { data: templates } = useTemplates();
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    async function handlePreview() {
        // We do not yet have an invoice ID before creation; preview will be based on current form state in future.
        // For now, preview requires an existing invoice; this is a simple disabled state.
        setPreviewUrl(null);
    }

    const selectedTemplate: Template | undefined = useMemo(() => {
        const list = templates ?? [];
        if (!selectedTemplateId && list.length > 0) {
            // auto-select first template if none chosen
            setSelectedTemplateId(list[0].id);
            return list[0];
        }
        return list.find((t) => t.id === selectedTemplateId);
    }, [templates, selectedTemplateId]);

    const invoiceContext = useMemo(() => ({ invoice: values }), [values]);

    type BoundInput = {
        id: string;
        binding: string;
        variant: "text" | "number" | "date";
        placeholder?: string;
    };

    const boundInputs: BoundInput[] = useMemo(() => {
        if (!selectedTemplate) return [];
        const elements = selectedTemplate.elements ?? [];
        const map = new Map<string, BoundInput>();
        for (const raw of elements) {
            if (raw.type === "input") {
                const el = raw as Extract<TemplateElement, { type: "input" }>;
                if (!el.binding) continue;
                if (el.binding.startsWith("invoice.items")) continue;
                const existing = map.get(el.binding);
                const next: BoundInput = { id: el.id, binding: el.binding, variant: el.variant, placeholder: el.placeholder };
                if (!existing) {
                    map.set(el.binding, next);
                } else {
                    const priority = (v: BoundInput["variant"]) => (v === "date" ? 3 : v === "number" ? 2 : 1);
                    if (priority(el.variant) > priority(existing.variant)) {
                        map.set(el.binding, next);
                    }
                }
            } else if (raw.type === "text") {
                const t = raw as Extract<TemplateElement, { type: "text" }>;
                if (!t.binding) continue;
                if (t.binding.startsWith("invoice.items")) continue;
                if (!map.has(t.binding)) {
                    map.set(t.binding, { id: t.id, binding: t.binding, variant: "text", placeholder: undefined });
                }
            }
        }
        return Array.from(map.values());
    }, [selectedTemplate]);

    function bindingToFormPath(binding: string): FieldPath<InvoiceData> {
        const path = binding.startsWith("invoice.") ? binding.slice("invoice.".length) : binding;
        return path as FieldPath<InvoiceData>;
    }

    function labelFromPath(path: string): string {
        const last = path.split(".").pop() || path;
        return last
            .replace(/([A-Z])/g, " $1")
            .replace(/[-_]/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase());
    }

    // Derive dynamic table columns from the selected template (first table only)
    type DynamicColumn = {
        id: string;
        header: string;
        inputType: "text" | "number" | "date";
        kind: { type: "native"; key: "description" | "qty" | "unitPrice" } | { type: "extra" };
    };

    const dynamicTable = useMemo(() => {
        const table = (selectedTemplate?.elements ?? []).find((e) => e.type === "table") as Extract<TemplateElement, { type: "table" }> | undefined;
        if (!table) return null;
        // Only respect tables bound to invoice.items
        if (!table.itemsBinding || !table.itemsBinding.startsWith("invoice.items")) return null;

        function guessNativeKey(binding?: string, header?: string): "description" | "qty" | "unitPrice" | undefined {
            const b = binding || "";
            const h = (header || "").toLowerCase();
            if (b.endsWith("description") || h.includes("desc")) return "description";
            if (b.endsWith("qty") || h.includes("qty") || h.includes("quantity")) return "qty";
            if (b.endsWith("unitPrice") || h.includes("price")) return "unitPrice";
            return undefined;
        }

        const cols: DynamicColumn[] = (table.columns ?? []).map((c) => {
            const binding = c.binding || "";
            const key = binding.startsWith("invoice.items.") ? binding.replace("invoice.items.", "") : guessNativeKey(binding, c.header);
            const header = c.header || labelFromPath(key || c.id);
            const kind: DynamicColumn["kind"] = key === "description" || key === "qty" || key === "unitPrice" ? { type: "native", key } : { type: "extra" } as const;
            const inputType: "text" | "number" | "date" = c.type ?? (key === "description" ? "text" : key ? "number" : "text");
            return { id: c.id, header, inputType, kind };
        });
        return { columns: cols };
    }, [selectedTemplate]);

    // Local state for extra (non-native) table columns values per row
    const [tableExtras, setTableExtras] = useState<Record<string, Record<string, string>>>({});

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8 rounded-[32px] bg-gradient-to-r from-[#eafcff] to-white p-6 md:p-10 border border-custom">
                <div className="flex flex-col gap-3 md:gap-4">
                    <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
                        Craft a clear, trustworthy invoice
                    </h1>
                    <p className="text-gray max-w-2xl">
                        Use a clean, structured layout so clients can scan quickly. Your brand-first design ensures confidence at every step.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Live preview - takes most of the page */}
                <div className="lg:col-span-2">
                    <Card className="card-large">
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedTemplate ? (
                                <div className="w-full overflow-auto">
                                    <TemplatePreview template={selectedTemplate} context={invoiceContext} zoom={0.95} />
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">Select a template on the right to preview your invoice as you fill the fields.</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar - dynamic fields from template and totals */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Template</CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col">
                                    
                                        <Label>Choose a template</Label>
                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select a template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(templates ?? []).map((t) => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    
                                </CardContent>
                            </Card>
                            {/* Dynamic fields from template input bindings */}
                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Fields</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 gap-4">
                                    {boundInputs.length === 0 && (
                                        <div className="text-sm text-muted-foreground">This template has no bound input fields.</div>
                                    )}
                                    {boundInputs.map((bi) => {
                                        const formPath = bindingToFormPath(bi.binding);
                                        return (
                                            <FormField
                                                key={bi.binding}
                                                control={form.control}
                                                name={formPath}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{labelFromPath(String(formPath))}</FormLabel>
                                                        <FormControl>
                                                            {bi.variant === "date" ? (
                                                                <Input
                                                                    type="date"
                                                                    placeholder={bi.placeholder}
                                                                    value={typeof field.value === "string" ? field.value : ""}
                                                                    onChange={(e) => field.onChange(e.target.value)}
                                                                />
                                                            ) : bi.variant === "number" ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    placeholder={bi.placeholder}
                                                                    value={
                                                                        typeof field.value === "number"
                                                                            ? field.value
                                                                            : typeof field.value === "string" && field.value !== ""
                                                                                ? Number(field.value) || 0
                                                                                : ""
                                                                    }
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        field.onChange(v === "" ? "" : Number(v));
                                                                    }}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    placeholder={bi.placeholder}
                                                                    value={typeof field.value === "string" ? field.value : ""}
                                                                    onChange={(e) => field.onChange(e.target.value)}
                                                                />
                                                            )}
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        );
                                    })}
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
                                    {/* Items table inlined here only if template has a bound items table */}
                                    {dynamicTable && (
                                    <div className="space-y-3">
                                        {dynamicTable ? (
                                            <div className="hidden md:grid text-sm text-muted-foreground" style={{ gridTemplateColumns: `repeat(${dynamicTable.columns.length + 1}, minmax(0, 1fr))`, display: 'grid', gap: '0.75rem' }}>
                                                {dynamicTable.columns.map((c) => (
                                                    <div key={c.id}>{c.header}</div>
                                                ))}
                                                <div className="text-right">Line total</div>
                                            </div>
                                        ) : (
                                            <div className="hidden grid-cols-12 gap-3 md:grid text-sm text-muted-foreground">
                                                <div className="col-span-6">Description</div>
                                                <div className="col-span-2">Qty</div>
                                                <div className="col-span-2">Unit price</div>
                                                <div className="col-span-2 text-right">Line total</div>
                                            </div>
                                        )}

                                        {fields.map((fieldItem, index) => (
                                            <div key={fieldItem.id} className="grid grid-cols-1 gap-3 md:items-center" style={dynamicTable ? { gridTemplateColumns: `repeat(${dynamicTable.columns.length + 1}, minmax(0, 1fr))` } : undefined}>
                                                {dynamicTable ? (
                                                    <>
                                                        {dynamicTable.columns.map((c) => (
                                                            <FormField
                                                                key={c.id}
                                                                control={form.control}
                                                                name={c.kind.type === 'native' ? (`items.${index}.${c.kind.key}` as const) : (`items.${index}.description` as const)}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="md:hidden">{c.header}</FormLabel>
                                                                        <FormControl>
                                                                            {c.kind.type === 'native' ? (
                                                                                c.inputType === 'number' ? (
                                                                                    <Input type="number" inputMode="decimal" value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
                                                                                ) : c.inputType === 'date' ? (
                                                                                    <Input type="date" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                                                                                ) : (
                                                                                    <Input placeholder="Text" {...field} />
                                                                                )
                                                                            ) : (
                                                                                <Input
                                                                                    placeholder="Text"
                                                                                    value={tableExtras[fieldItem.id]?.[c.id] ?? ''}
                                                                                    onChange={(e) => setTableExtras((prev) => ({
                                                                                        ...prev,
                                                                                        [fieldItem.id]: { ...(prev[fieldItem.id] ?? {}), [c.id]: e.target.value },
                                                                                    }))}
                                                                                />
                                                                            )}
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        ))}
                                                        <div className="flex items-center justify-between md:justify-end gap-2">
                                                            <div className="text-right font-medium">
                                                                {(() => {
                                                                    const item = form.getValues().items?.[index];
                                                                    const qty = Number(item?.qty || 0);
                                                                    const price = Number(item?.unitPrice || 0);
                                                                    return (qty * price).toFixed(2);
                                                                })()}
                                                            </div>
                                                            <Button type="button" variant="ghost" onClick={() => remove(index)}>Remove</Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
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
                                                                        <Input type="number" inputMode="numeric" min={0} step="1" value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
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
                                                                        <Input type="number" inputMode="decimal" step="0.01" min={0} value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} />
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
                                                            <Button type="button" variant="ghost" onClick={() => remove(index)}>Remove</Button>
                                                        </div>
                                                    </>
                                                )}
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
                                    </div>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="flex items-center justify-end gap-3">
                                <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="secondary" className="btn-secondary" onClick={handlePreview} disabled>
                                            <Eye className="mr-2 h-4 w-4" /> Preview
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl">
                                        <DialogHeader>
                                            <DialogTitle>Invoice preview</DialogTitle>
                                        </DialogHeader>
                                        <div className="aspect-[1/1.414] w-full overflow-hidden rounded border bg-muted">
                                            {previewUrl ? (
                                                <iframe title="invoice-preview" src={previewUrl} className="h-full w-full" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Preview requires a saved invoice</div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Button type="submit" className="btn-primary" disabled={mutation.isPending}>
                                    {mutation.isPending ? "Creating..." : "Create invoice"}
                                </Button>
                            </div>

                            {/* Totals card at bottom of sidebar */}
                            <Card className="card-large">
                                <CardHeader>
                                    <CardTitle>Calculated totals</CardTitle>
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
                                </CardContent>
                            </Card>
                        </form>
                    </Form>
                    
                </div>
            </div>
        </div>
    );
}

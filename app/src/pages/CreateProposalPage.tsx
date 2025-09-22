import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calculator } from "lucide-react";
import { useCreateProposal } from "@/hooks/use-proposal";
import { calculateTotals } from "@/core";
import { toast } from "sonner";

const proposalItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  qty: z.number().min(0, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  taxPct: z.number().min(0).max(100).optional(),
});

const createProposalSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  items: z.array(proposalItemSchema).min(1, "At least one item is required"),
  currency: z.string().min(1, "Currency is required"),
  terms: z.string().optional(),
  notes: z.string().optional(),
  vatRatePct: z.number().min(0).max(100).optional(),
});

type CreateProposalForm = z.infer<typeof createProposalSchema>;

export const CreateProposalPage: React.FC = () => {
  const navigate = useNavigate();
  const createProposalMutation = useCreateProposal();
  const [totals, setTotals] = useState({ subtotal: 0, taxTotal: 0, total: 0 });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateProposalForm>({
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      orgId: "default-org",
      customerId: "default-customer",
      title: "",
      description: "",
      items: [{ description: "", qty: 1, unitPrice: 0 }],
      currency: "USD",
      terms: "",
      notes: "",
      vatRatePct: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const watchedVatRate = watch("vatRatePct");

  // Calculate totals whenever items or VAT rate changes
  React.useEffect(() => {
    const calculatedTotals = calculateTotals(watchedItems, watchedVatRate);
    setTotals(calculatedTotals);
  }, [watchedItems, watchedVatRate]);

  const onSubmit = async (data: CreateProposalForm) => {
    try {
      const proposalId = await createProposalMutation.mutateAsync(data);
      toast.success("Proposal created successfully!");
      navigate(`/proposals/${proposalId}`);
    } catch (error) {
      toast.error("Failed to create proposal");
      console.error("Error creating proposal:", error);
    }
  };

  const addItem = () => {
    append({ description: "", qty: 1, unitPrice: 0 });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Proposal</h1>
        <p className="text-muted-foreground mt-2">
          Create a new proposal for your customer with detailed line items and pricing.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for your proposal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="Proposal title"
                />
                {errors.title && (
                  <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="currency">Currency *</Label>
                <Select {...register("currency")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
                {errors.currency && (
                  <p className="text-sm text-red-500 mt-1">{errors.currency.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Brief description of the proposal"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="orgId">Organization ID *</Label>
                <Input
                  id="orgId"
                  {...register("orgId")}
                  placeholder="Organization ID"
                />
                {errors.orgId && (
                  <p className="text-sm text-red-500 mt-1">{errors.orgId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="customerId">Customer ID *</Label>
                <Input
                  id="customerId"
                  {...register("customerId")}
                  placeholder="Customer ID"
                />
                {errors.customerId && (
                  <p className="text-sm text-red-500 mt-1">{errors.customerId.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
            <CardDescription>
              Add the items and services for this proposal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Item {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor={`items.${index}.description`}>Description *</Label>
                    <Input
                      {...register(`items.${index}.description`)}
                      placeholder="Item description"
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`items.${index}.qty`}>Quantity *</Label>
                    <Input
                      type="number"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      placeholder="1"
                      min="0"
                      step="0.01"
                    />
                    {errors.items?.[index]?.qty && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.items[index]?.qty?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`items.${index}.unitPrice`}>Unit Price *</Label>
                    <Input
                      type="number"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    {errors.items?.[index]?.unitPrice && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.items[index]?.unitPrice?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`items.${index}.taxPct`}>Tax % (Optional)</Label>
                    <Input
                      type="number"
                      {...register(`items.${index}.taxPct`, { valueAsNumber: true })}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-muted-foreground">
                      Line Total: ${(watchedItems[index]?.qty || 0) * (watchedItems[index]?.unitPrice || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Settings</CardTitle>
            <CardDescription>
              Set default tax rate for items without specific tax percentages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="vatRatePct">Default VAT Rate (%)</Label>
              <Input
                id="vatRatePct"
                type="number"
                {...register("vatRatePct", { valueAsNumber: true })}
                placeholder="0"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Totals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Total:</span>
                <span>${totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>
              Add terms, conditions, and notes for this proposal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                {...register("terms")}
                placeholder="Payment terms, delivery conditions, etc."
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Additional notes or comments"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createProposalMutation.isPending}
          >
            {createProposalMutation.isPending ? "Creating..." : "Create Proposal"}
          </Button>
        </div>
      </form>
    </div>
  );
};

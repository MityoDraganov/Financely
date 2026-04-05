import { useState, useEffect } from "react";
import { Sparkles, Loader2, Save, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposalData, ProposalItem } from "@/core";
import { useGenerateProposalSuggestion } from "@/hooks/service-hooks/use-proposal-generation";
import { useCreateProposal } from "@/hooks/repository-hooks/use-proposals";
import { toast } from "sonner";
import { formatProposalCurrency } from "@/utils/proposal-currency";

interface ProposalSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadData: {
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
    message?: string;
    formData?: Record<string, unknown>;
    organizationId: string;
  };
  organizationName?: string;
}

export function ProposalSuggestionDialog({
  open,
  onOpenChange,
  leadId,
  leadData,
}: ProposalSuggestionDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProposal, setEditedProposal] = useState<ProposalData | null>(null);
  
  const generateMutation = useGenerateProposalSuggestion();
  const createMutation = useCreateProposal();

  // Generate suggestion when dialog opens
  useEffect(() => {
    if (open && !editedProposal && !generateMutation.isPending) {
      handleGenerate();
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!leadData.organizationId) {
      toast.error("Organization ID is required");
      return;
    }
    try {
      const suggestion = await generateMutation.mutateAsync({
        leadId,
        organizationId: leadData.organizationId,
      });
      
      setEditedProposal(suggestion);
      setIsEditing(false);
    } catch (error) {
      toast.error(
        `Failed to generate suggestion: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleSave = async () => {
    if (!editedProposal) return;

    try {
      await createMutation.mutateAsync(editedProposal);
      toast.success("Proposal created successfully");
      onOpenChange(false);
      setEditedProposal(null);
      setIsEditing(false);
    } catch (error) {
      toast.error(
        `Failed to create proposal: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleEditItem = (index: number, field: keyof ProposalItem, value: string | number) => {
    if (!editedProposal) return;

    const updatedItems = [...editedProposal.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const taxTotal = updatedItems.reduce(
      (sum, item) => sum + (item.qty * item.unitPrice * (item.taxPct || 0)) / 100,
      0
    );
    const total = subtotal + taxTotal;

    setEditedProposal({
      ...editedProposal,
      items: updatedItems,
      subtotal,
      taxTotal,
      total,
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return formatProposalCurrency(amount, currency);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Proposal Suggestion
          </DialogTitle>
          <DialogDescription>
            Review and edit the AI-generated proposal suggestion, then save it as a proposal.
          </DialogDescription>
        </DialogHeader>

        {generateMutation.isPending ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Generating proposal suggestion...</p>
            </div>
          </div>
        ) : editedProposal ? (
          <div className="space-y-6">
            {/* Title and Description */}
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={editedProposal.title}
                      onChange={(e) =>
                        setEditedProposal({ ...editedProposal, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editedProposal.description || ""}
                      onChange={(e) =>
                        setEditedProposal({ ...editedProposal, description: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold">{editedProposal.title}</h3>
                    {editedProposal.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {editedProposal.description}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>
                  {editedProposal.items.length} item{editedProposal.items.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {editedProposal.items.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      {isEditing ? (
                        <>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                handleEditItem(index, "description", e.target.value)
                              }
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Quantity</Label>
                              <Input
                                type="number"
                                min="0"
                                value={item.qty}
                                onChange={(e) =>
                                  handleEditItem(index, "qty", parseFloat(e.target.value) || 0)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit Price</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleEditItem(
                                    index,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tax %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.taxPct || 0}
                                onChange={(e) =>
                                  handleEditItem(
                                    index,
                                    "taxPct",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.qty} × {formatCurrency(item.unitPrice, editedProposal.currency)}
                              {item.taxPct && item.taxPct > 0 && (
                                <span className="ml-2">+ {item.taxPct}% tax</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(
                                item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100),
                                editedProposal.currency
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(editedProposal.subtotal, editedProposal.currency)}
                  </span>
                </div>
                {editedProposal.taxTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      {formatCurrency(editedProposal.taxTotal, editedProposal.currency)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(editedProposal.total, editedProposal.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Terms and Notes */}
            {(editedProposal.terms || editedProposal.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing ? (
                    <>
                      {editedProposal.terms !== undefined && (
                        <div className="space-y-2">
                          <Label>Payment Terms</Label>
                          <Textarea
                            value={editedProposal.terms || ""}
                            onChange={(e) =>
                              setEditedProposal({ ...editedProposal, terms: e.target.value })
                            }
                            rows={2}
                          />
                        </div>
                      )}
                      {editedProposal.notes !== undefined && (
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={editedProposal.notes || ""}
                            onChange={(e) =>
                              setEditedProposal({ ...editedProposal, notes: e.target.value })
                            }
                            rows={3}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {editedProposal.terms && (
                        <div>
                          <h4 className="font-medium mb-2">Payment Terms</h4>
                          <p className="text-sm text-muted-foreground">{editedProposal.terms}</p>
                        </div>
                      )}
                      {editedProposal.notes && (
                        <div>
                          <h4 className="font-medium mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground">{editedProposal.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setEditedProposal(null);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              {editedProposal && (
                <>
                  {isEditing ? (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel Edit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Proposal
                      </>
                    )}
                  </Button>
                </>
              )}
              {!editedProposal && !generateMutation.isPending && (
                <Button onClick={handleGenerate} variant="outline">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

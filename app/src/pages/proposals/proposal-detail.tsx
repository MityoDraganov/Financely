import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, FileText, User, Mail, Phone, Building2, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProposal } from "@/hooks/repository-hooks/use-proposals";
import { useLead } from "@/hooks/repository-hooks/use-leads";
import { PROPOSAL_STATUSES } from "@/core";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useConvertProposalToInvoice } from "@/hooks/service-hooks/use-convert-proposal-to-invoice";
import { toast } from "sonner";

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useProposal(id);
  const { data: lead, isLoading: isLeadLoading } = useLead(proposal?.leadId);
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);
  const convertProposal = useConvertProposalToInvoice();
  
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case PROPOSAL_STATUSES.DRAFT:
        return "bg-gray-100 text-gray-800";
      case PROPOSAL_STATUSES.SENT:
        return "bg-blue-100 text-blue-800";
      case PROPOSAL_STATUSES.ACCEPTED:
        return "bg-green-100 text-green-800";
      case PROPOSAL_STATUSES.REJECTED:
        return "bg-red-100 text-red-800";
      case PROPOSAL_STATUSES.EXPIRED:
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">Proposal not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The proposal you're looking for doesn't exist or has been deleted.
          </p>
          <Button className="mt-4" onClick={() => navigate("/proposals")}>
            Back to Proposals
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/proposals")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{proposal.title}</h1>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(proposal.status)}>
                  {proposal.status}
                </Badge>
                {proposal.createdAt && (
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Created {format(new Date(proposal.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Proposal Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {proposal.description && (
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{proposal.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>
                  {proposal.items.length} item{proposal.items.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proposal.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.qty} × {formatCurrency(item.unitPrice, proposal.currency)}
                          {item.taxPct && item.taxPct > 0 && (
                            <span className="ml-2">+ {item.taxPct}% tax</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(
                            item.qty * item.unitPrice * (1 + (item.taxPct || 0) / 100),
                            proposal.currency
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Terms and Notes */}
            {(proposal.terms || proposal.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {proposal.terms && (
                    <div>
                      <h4 className="font-medium mb-2">Payment Terms</h4>
                      <p className="text-sm text-muted-foreground">{proposal.terms}</p>
                    </div>
                  )}
                  {proposal.notes && (
                    <div>
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground">{proposal.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(proposal.subtotal, proposal.currency)}
                  </span>
                </div>
                {proposal.taxTotal > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      {formatCurrency(proposal.taxTotal, proposal.currency)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(proposal.total, proposal.currency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Lead/Client Information */}
            {proposal.leadId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Client Information
                  </CardTitle>
                  <CardDescription>
                    {isLeadLoading ? "Loading..." : lead ? "Linked to lead" : "Lead not found"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLeadLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : lead ? (
                    <div className="space-y-4">
                      {/* Contact Name */}
                      {(lead.data?.firstName || lead.data?.lastName) && (
                        <div className="flex items-start gap-3">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">
                              {[lead.data.firstName, lead.data.lastName].filter(Boolean).join(" ") || "Unknown"}
                            </p>
                            {lead.data.jobTitle && (
                              <p className="text-xs text-muted-foreground">{lead.data.jobTitle}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Company */}
                      {lead.data?.company && (
                        <div className="flex items-start gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{lead.data.company}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Email */}
                      {lead.data?.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <a 
                              href={`mailto:${lead.data.email}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {lead.data.email}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Phone */}
                      {lead.data?.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <a 
                              href={`tel:${lead.data.phone}`}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {lead.data.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      
                      {/* Message */}
                      {lead.data?.message && (
                        <div className="flex items-start gap-3 pt-2 border-t">
                          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Message:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {lead.data.message}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Lead Status */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Lead Status</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {lead.data?.status || "new"}
                          </Badge>
                        </div>
                        {lead.data?.widgetType && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">Source</span>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {lead.data.widgetType.replace(/([A-Z])/g, " $1").trim()}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Lead information not available</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{proposal.currency}</span>
                </div>
                {proposal.leadId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lead ID</span>
                    <span className="font-medium font-mono text-xs">{proposal.leadId.slice(0, 8)}</span>
                  </div>
                )}
                {proposal.invoiceId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invoice ID</span>
                    <span className="font-medium font-mono text-xs">{proposal.invoiceId.slice(0, 8)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Convert to Invoice */}
            {!proposal.invoiceId && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setConvertDialogOpen(true)}
                    className="w-full"
                    variant="default"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Convert to Invoice (AI)
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Convert to Invoice Dialog */}
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Convert Proposal to Invoice
            </DialogTitle>
            <DialogDescription>
              Use AI to automatically convert this proposal into a compliant invoice. Select an invoice template to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Invoice Template</Label>
              {isTemplatesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name || template.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {templates && templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates available. Please create an invoice template first.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={convertProposal.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedTemplateId) {
                  toast.error("Please select a template");
                  return;
                }
                if (!proposal) {
                  toast.error("Proposal not found");
                  return;
                }
                if (!currentOrganization) {
                  toast.error("Organization not found");
                  return;
                }

                try {
                  const result = await convertProposal.mutateAsync({
                    proposalId: proposal.id,
                    templateId: selectedTemplateId,
                    organizationId: currentOrganization.id,
                  });
                  
                  toast.success("Invoice created successfully!");
                  setConvertDialogOpen(false);
                  navigate(`/invoices/${result.invoiceId}`);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(`Failed to convert proposal: ${message}`);
                }
              }}
              disabled={convertProposal.isPending || !selectedTemplateId || !templates || templates.length === 0}
            >
              {convertProposal.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Convert to Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  );
}


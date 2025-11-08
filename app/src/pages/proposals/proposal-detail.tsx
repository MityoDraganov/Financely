import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProposal } from "@/hooks/repository-hooks/use-proposals";
import { PROPOSAL_STATUSES } from "@/core";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: proposal, isLoading } = useProposal(id);

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
          </div>
        </div>
      </div>
  );
}


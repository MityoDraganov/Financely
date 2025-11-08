import { useState } from "react";
import { Search, Mail, Phone, Building, MessageSquare, Calendar, Eye} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeadsByOrg, useUpdateLead } from "@/hooks/repository-hooks/use-leads";
import { useOrganizationContext } from "@/contexts/organization-context";
import { Lead } from "@/core";
import { format } from "date-fns";

export default function LeadsPage() {
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [widgetTypeFilter, setWidgetTypeFilter] = useState<string>("all");

  // Queries
  const { data: leads = [], isLoading: isLoadingLeads, error } = useLeadsByOrg(currentOrganization?.id);
  const updateLeadMutation = useUpdateLead();
  console.log('leads error', error);
  console.log('leads', leads);

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const leadData = lead.data || lead;
    
    // Status filter
    if (statusFilter !== "all" && leadData.status !== statusFilter) {
      return false;
    }

    // Widget type filter
    if (widgetTypeFilter !== "all" && leadData.widgetType !== widgetTypeFilter) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const firstName = (leadData.firstName || "").toLowerCase();
      const lastName = (leadData.lastName || "").toLowerCase();
      const email = (leadData.email || "").toLowerCase();
      const company = (leadData.company || "").toLowerCase();
      const message = (leadData.message || "").toLowerCase();
      
      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        email.includes(searchLower) ||
        company.includes(searchLower) ||
        message.includes(searchLower)
      );
    }

    return true;
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    await updateLeadMutation.mutateAsync({
      id: leadId,
      data: { status: newStatus as Lead["data"]["status"] },
    });
  };

  const openDetailDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "viewed": return "bg-yellow-100 text-yellow-800";
      case "contacted": return "bg-purple-100 text-purple-800";
      case "converted": return "bg-green-100 text-green-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getWidgetTypeLabel = (widgetType: string) => {
    switch (widgetType) {
      case "contactForm": return "Contact Form";
      case "invoiceRequest": return "Invoice Request";
      case "quoteRequest": return "Quote Request";
      default: return widgetType;
    }
  };

  const getWidgetTypeColor = (widgetType: string) => {
    switch (widgetType) {
      case "contactForm": return "bg-blue-100 text-blue-800";
      case "invoiceRequest": return "bg-green-100 text-green-800";
      case "quoteRequest": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoadingLeads) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">View all form submissions and messages</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">View all form submissions and messages</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={widgetTypeFilter} onValueChange={setWidgetTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="contactForm">Contact Form</SelectItem>
            <SelectItem value="invoiceRequest">Invoice Request</SelectItem>
            <SelectItem value="quoteRequest">Quote Request</SelectItem>
          </SelectContent>
        </Select>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredLeads.length}</span>
            <span className="text-sm text-muted-foreground">leads</span>
          </div>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            {searchTerm.trim() || statusFilter !== "all" || widgetTypeFilter !== "all"
              ? `Showing ${filteredLeads.length} of ${leads.length} leads`
              : `Showing all ${leads.length} leads`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No leads</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim() || statusFilter !== "all" || widgetTypeFilter !== "all"
                  ? "No leads match your filters."
                  : "Form submissions will appear here."
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const leadData = lead.data || lead;
                  
                  if (!lead || !lead.id) {
                    return null;
                  }
                  
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {lead.createdAt 
                              ? format(new Date(lead.createdAt), "MMM d, yyyy")
                              : "N/A"
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {leadData.firstName || leadData.lastName
                          ? `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim()
                          : "N/A"
                        }
                      </TableCell>
                      <TableCell>
                        {leadData.email ? (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{leadData.email}</span>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getWidgetTypeColor(leadData.widgetType)}>
                          {getWidgetTypeLabel(leadData.widgetType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate">
                          {leadData.message || "No message"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(leadData.status || "new")}>
                          {leadData.status || "new"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailDialog(lead)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Select
                            value={leadData.status || "new"}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger className="h-8 w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="viewed">Viewed</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              View complete information about this lead submission
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Submitted</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedLead.createdAt 
                      ? format(new Date(selectedLead.createdAt), "PPpp")
                      : "N/A"
                    }
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedLead.data?.status || "new"}
                    onValueChange={(value) => handleStatusChange(selectedLead.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="viewed">Viewed</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Widget Type</Label>
                <Badge className={getWidgetTypeColor(selectedLead.data?.widgetType || "")}>
                  {getWidgetTypeLabel(selectedLead.data?.widgetType || "")}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <div className="text-sm">
                    {selectedLead.data?.firstName || selectedLead.data?.lastName
                      ? `${selectedLead.data?.firstName || ""} ${selectedLead.data?.lastName || ""}`.trim()
                      : "N/A"
                    }
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="text-sm flex items-center space-x-2">
                    {selectedLead.data?.email ? (
                      <>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.data.email}</span>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="text-sm flex items-center space-x-2">
                    {selectedLead.data?.phone ? (
                      <>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.data.phone}</span>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <div className="text-sm flex items-center space-x-2">
                    {selectedLead.data?.company ? (
                      <>
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.data.company}</span>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </div>
                </div>
              </div>

              {selectedLead.data?.jobTitle && (
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <div className="text-sm">{selectedLead.data.jobTitle}</div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={selectedLead.data?.message || ""}
                  readOnly
                  rows={4}
                  className="bg-muted"
                />
              </div>

              {selectedLead.data?.formData && Object.keys(selectedLead.data.formData).length > 0 && (
                <div className="space-y-2">
                  <Label>Form Data</Label>
                  <div className="bg-muted p-4 rounded-md">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(selectedLead.data.formData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedLead.data?.notes && (
                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea
                    value={selectedLead.data.notes}
                    readOnly
                    rows={3}
                    className="bg-muted"
                  />
                </div>
              )}

              {selectedLead.data?.tags && selectedLead.data.tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedLead.data.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Calendar, DollarSign, Eye, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposalsByOrg } from "@/hooks/repository-hooks/use-proposals";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { PROPOSAL_STATUSES } from "@/core";

export default function ProposalsPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: proposals = [], isLoading } = useProposalsByOrg(currentOrganization?.id);

  // Filter proposals
  const filteredProposals = proposals.filter((proposal) => {
    // Status filter
    if (statusFilter !== "all" && proposal.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const title = (proposal.title || "").toLowerCase();
      const description = (proposal.description || "").toLowerCase();
      
      return title.includes(searchLower) || description.includes(searchLower);
    }

    return true;
  });

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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('proposals.title')}</h1>
            <p className="text-muted-foreground">{t('proposals.subtitleLoading')}</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('proposals.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 pr-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('proposals.title')}</h1>
          <p className="text-muted-foreground">{t('proposals.subtitle')}</p>
        </div>
        <Button onClick={() => navigate("/proposals/new")}>
          <Plus className="h-4 w-4 mr-2" />
          {t('proposals.newProposal')}
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('proposals.filters.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('proposals.filters.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('proposals.filters.allStatuses')}</SelectItem>
            <SelectItem value={PROPOSAL_STATUSES.DRAFT}>{t('proposals.status.DRAFT')}</SelectItem>
            <SelectItem value={PROPOSAL_STATUSES.SENT}>{t('proposals.status.SENT')}</SelectItem>
            <SelectItem value={PROPOSAL_STATUSES.ACCEPTED}>{t('proposals.status.ACCEPTED')}</SelectItem>
            <SelectItem value={PROPOSAL_STATUSES.REJECTED}>{t('proposals.status.REJECTED')}</SelectItem>
            <SelectItem value={PROPOSAL_STATUSES.EXPIRED}>{t('proposals.status.EXPIRED')}</SelectItem>
          </SelectContent>
        </Select>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredProposals.length}</span>
            <span className="text-sm text-muted-foreground">{t('proposals.filters.proposal')}</span>
          </div>
        </Card>
      </div>

      {/* Proposals Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('proposals.table.title')}</CardTitle>
          <CardDescription>
            {searchTerm.trim() || statusFilter !== "all"
              ? t('proposals.table.showing', { count: filteredProposals.length, total: proposals.length })
              : t('proposals.table.showingAll', { count: proposals.length })
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredProposals.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{t('proposals.empty.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim() || statusFilter !== "all"
                  ? t('proposals.empty.noMatch')
                  : t('proposals.empty.getStarted')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('proposals.table.titleHeader')}</TableHead>
                  <TableHead>{t('proposals.table.date')}</TableHead>
                  <TableHead>{t('proposals.table.status')}</TableHead>
                  <TableHead>{t('proposals.table.total')}</TableHead>
                  <TableHead>{t('proposals.table.items')}</TableHead>
                  <TableHead className="w-[120px]">{t('proposals.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {proposal.aiGenerated && (
                          <div title={t('proposals.table.aiGenerated')}>
                            <Sparkles className="h-4 w-4 text-purple-500" />
                          </div>
                        )}
                        <span>{proposal.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {proposal.createdAt
                            ? formatDateTable(proposal.createdAt)
                            : t('proposals.labels.na')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(proposal.status)}>
                        {t(`proposals.status.${proposal.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(proposal.total, proposal.currency)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {proposal.items.length === 1
                          ? t('proposals.table.itemsCount', { count: proposal.items.length })
                          : t('proposals.table.itemsCountPlural', { count: proposal.items.length })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/proposals/${proposal.id}`)}
                        title={t('proposals.actions.view')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


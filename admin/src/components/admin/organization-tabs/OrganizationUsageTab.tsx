import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OrganizationUsage } from "@/hooks/admin/use-admin-organization-usage";
import { FileText, File, HardDrive, TrendingUp } from "lucide-react";
import { useAdminOverrideUsage } from "@/hooks/admin/use-admin-override-usage";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminRole } from "@/utils/admin-utils";

interface OrganizationUsageTabProps {
  organizationId: string | undefined;
  usage: OrganizationUsage | undefined;
}

export function OrganizationUsageTab({ organizationId, usage }: OrganizationUsageTabProps) {
  const overrideUsage = useAdminOverrideUsage();
  const adminRole = useAdminRole();
  const isSuperAdmin = adminRole === "superadmin";
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [overrideData, setOverrideData] = useState({
    templateCount: "",
    invoiceCount: "",
    memberCount: "",
    storageBytes: "",
  });

  const handleOpenOverrideDialog = () => {
    if (usage) {
      setOverrideData({
        templateCount: usage.templates.total.toString(),
        invoiceCount: usage.invoices.total.toString(),
        memberCount: "",
        storageBytes: usage.storage.bytes.toString(),
      });
      setIsOverrideDialogOpen(true);
    }
  };

  const handleOverrideUsage = () => {
    if (!organizationId) return;

    const usageOverrides: {
      templateCount?: number;
      invoiceCount?: number;
      memberCount?: number;
      storageBytes?: number;
    } = {};

    if (overrideData.templateCount) {
      const value = parseInt(overrideData.templateCount);
      if (!isNaN(value)) usageOverrides.templateCount = value;
    }
    if (overrideData.invoiceCount) {
      const value = parseInt(overrideData.invoiceCount);
      if (!isNaN(value)) usageOverrides.invoiceCount = value;
    }
    if (overrideData.memberCount) {
      const value = parseInt(overrideData.memberCount);
      if (!isNaN(value)) usageOverrides.memberCount = value;
    }
    if (overrideData.storageBytes) {
      const value = parseInt(overrideData.storageBytes);
      if (!isNaN(value)) usageOverrides.storageBytes = value;
    }

    if (Object.keys(usageOverrides).length === 0) {
      return;
    }

    overrideUsage.mutate({
      organizationId,
      usageOverrides,
    });
  };

  if (!usage) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invoice Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Usage
          </CardTitle>
          <CardDescription>Total invoices and status breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <div className="text-2xl font-bold">{usage.invoices.total}</div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-muted-foreground">
                {usage.invoices.draft}
              </div>
              <p className="text-sm text-muted-foreground">Draft</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{usage.invoices.sent}</div>
              <p className="text-sm text-muted-foreground">Sent</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{usage.invoices.paid}</div>
              <p className="text-sm text-muted-foreground">Paid</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {usage.invoices.cancelled}
              </div>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5" />
            Template Usage
          </CardTitle>
          <CardDescription>Total templates and active count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-bold">{usage.templates.total}</div>
              <p className="text-sm text-muted-foreground">Total Templates</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {usage.templates.active}
              </div>
              <p className="text-sm text-muted-foreground">Active Templates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>Total storage used by this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div className="text-2xl font-bold">{usage.storage.mb} MB</div>
            <p className="text-sm text-muted-foreground">
              {usage.storage.bytes.toLocaleString()} bytes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Override */}
      {isSuperAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Override
              </CardTitle>
              <CardDescription>Manually adjust usage counts (Superadmin only)</CardDescription>
            </div>
            <Button onClick={handleOpenOverrideDialog} variant="outline" size="sm">
              Override Usage
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Override Dialog */}
      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Usage</DialogTitle>
            <DialogDescription>
              Manually set usage counts for this organization. This will override the actual usage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="override-templates">Template Count</Label>
              <Input
                id="override-templates"
                type="number"
                value={overrideData.templateCount}
                onChange={(e) => setOverrideData({ ...overrideData, templateCount: e.target.value })}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-invoices">Invoice Count</Label>
              <Input
                id="override-invoices"
                type="number"
                value={overrideData.invoiceCount}
                onChange={(e) => setOverrideData({ ...overrideData, invoiceCount: e.target.value })}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-members">Member Count</Label>
              <Input
                id="override-members"
                type="number"
                value={overrideData.memberCount}
                onChange={(e) => setOverrideData({ ...overrideData, memberCount: e.target.value })}
                placeholder="Leave empty to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-storage">Storage Bytes</Label>
              <Input
                id="override-storage"
                type="number"
                value={overrideData.storageBytes}
                onChange={(e) => setOverrideData({ ...overrideData, storageBytes: e.target.value })}
                placeholder="Leave empty to keep current"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverrideUsage} disabled={overrideUsage.isPending} variant="destructive">
              {overrideUsage.isPending ? "Overriding..." : "Override Usage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


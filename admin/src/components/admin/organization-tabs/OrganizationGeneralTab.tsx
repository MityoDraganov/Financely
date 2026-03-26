import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Organization } from "@/core";
import { useAdminUpdateOrganization } from "@/hooks/admin/use-admin-update-organization";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrganizationGeneralTabProps {
  organization: Organization;
}

export function OrganizationGeneralTab({ organization }: OrganizationGeneralTabProps) {
  const updateOrganization = useAdminUpdateOrganization();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<{
    name?: string;
    description?: string;
    status?: "active" | "suspended" | "deleted";
  } | null>(null);
  const [editData, setEditData] = useState({
    name: organization.name || "",
    description: organization.description || "",
    status: (organization.status || "active") as "active" | "suspended" | "deleted",
    defaultLanguage: organization.settings?.defaultLanguage || "en",
  });

  const createdAt = organization.createdAt
    ? typeof organization.createdAt === "string"
      ? new Date(organization.createdAt)
      : organization.createdAt
    : null;

  const handleOpenEditDialog = () => {
    setEditData({
      name: organization.name || "",
      description: organization.description || "",
      status: (organization.status || "active") as "active" | "suspended" | "deleted",
      defaultLanguage: organization.settings?.defaultLanguage || "en",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrganization = () => {
    const updates: {
      name?: string;
      description?: string;
      status?: "active" | "suspended" | "deleted";
      settings?: Record<string, unknown>;
    } = {};

    if (editData.name !== organization.name) updates.name = editData.name;
    if (editData.description !== organization.description) updates.description = editData.description;
    if (editData.status !== organization.status) updates.status = editData.status;
    if (editData.defaultLanguage !== (organization.settings?.defaultLanguage || "en")) {
      updates.settings = { defaultLanguage: editData.defaultLanguage };
    }

    if (Object.keys(updates).length === 0) {
      setIsEditDialogOpen(false);
      return;
    }

    // Check if status change requires confirmation
    if (updates.status && updates.status !== organization.status) {
      setPendingUpdates(updates);
      setIsConfirmDialogOpen(true);
      setIsEditDialogOpen(false);
      return;
    }

    updateOrganization.mutate({
      organizationId: organization.id,
      updates,
    });
    setIsEditDialogOpen(false);
  };

  const handleConfirmUpdate = () => {
    if (!pendingUpdates) return;

    updateOrganization.mutate({
      organizationId: organization.id,
      updates: pendingUpdates,
    });
    setIsConfirmDialogOpen(false);
    setPendingUpdates(null);
  };

  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Organization details and settings</CardDescription>
          </div>
          <Button onClick={handleOpenEditDialog} variant="outline" size="sm">
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <div className="text-base font-medium">{organization.name || "Unnamed"}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div>
                <Badge variant={organization.status === "active" ? "default" : "destructive"}>
                  {organization.status || "active"}
                </Badge>
              </div>
            </div>
            {organization.description && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="text-base">{organization.description}</div>
              </div>
            )}
            {organization.website && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Website</label>
                <div className="text-base">
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {organization.website}
                  </a>
                </div>
              </div>
            )}
            {createdAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <div className="text-base">{createdAt.toLocaleDateString()}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Information */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Current plan and billing status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Plan</label>
              <div className="text-base font-medium">
                <Badge variant="outline">{organization.subscription?.plan || "free"}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div>
                <Badge
                  variant={
                    organization.subscription?.status === "active"
                      ? "default"
                      : organization.subscription?.status === "past_due"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {organization.subscription?.status || "none"}
                </Badge>
              </div>
            </div>
            {organization.subscription?.currentPeriodStart && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Period Start</label>
                <div className="text-base">
                  {new Date(organization.subscription.currentPeriodStart).toLocaleDateString()}
                </div>
              </div>
            )}
            {organization.subscription?.currentPeriodEnd && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Period End</label>
                <div className="text-base">
                  {new Date(organization.subscription.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
            )}
            {organization.subscription?.trialEnd && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Trial End</label>
                <div className="text-base">
                  {new Date(organization.subscription.trialEnd).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      {organization.settings && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Organization configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Default Currency</label>
                <div className="text-base">{organization.settings.defaultCurrency || "USD"}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Default Language</label>
                <div className="text-base">{organization.settings.defaultLanguage || "en"}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Default Timezone</label>
                <div className="text-base">{organization.settings.defaultTimezone || "UTC"}</div>
              </div>
              {organization.settings.country && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <div className="text-base">{organization.settings.country}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization information. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editData.status}
                onValueChange={(value) =>
                  setEditData({ ...editData, status: value as typeof editData.status })
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-language">Default Language</Label>
              <Select
                value={editData.defaultLanguage}
                onValueChange={(value) => setEditData({ ...editData, defaultLanguage: value })}
              >
                <SelectTrigger id="edit-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg">Bulgarian (bg)</SelectItem>
                  <SelectItem value="cs">Czech (cs)</SelectItem>
                  <SelectItem value="de">German (de)</SelectItem>
                  <SelectItem value="el">Greek (el)</SelectItem>
                  <SelectItem value="en">English (en)</SelectItem>
                  <SelectItem value="es">Spanish (es)</SelectItem>
                  <SelectItem value="fr">French (fr)</SelectItem>
                  <SelectItem value="hr">Croatian (hr)</SelectItem>
                  <SelectItem value="hu">Hungarian (hu)</SelectItem>
                  <SelectItem value="it">Italian (it)</SelectItem>
                  <SelectItem value="nl">Dutch (nl)</SelectItem>
                  <SelectItem value="pl">Polish (pl)</SelectItem>
                  <SelectItem value="pt">Portuguese (pt)</SelectItem>
                  <SelectItem value="ro">Romanian (ro)</SelectItem>
                  <SelectItem value="ru">Russian (ru)</SelectItem>
                  <SelectItem value="sk">Slovak (sk)</SelectItem>
                  <SelectItem value="sl">Slovenian (sl)</SelectItem>
                  <SelectItem value="sr">Serbian (sr)</SelectItem>
                  <SelectItem value="tr">Turkish (tr)</SelectItem>
                  <SelectItem value="uk">Ukrainian (uk)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrganization} disabled={updateOrganization.isPending}>
              {updateOrganization.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Status Changes */}
      <ConfirmDialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        onConfirm={handleConfirmUpdate}
        title="Confirm Status Change"
        description={
          pendingUpdates?.status
            ? `Are you sure you want to change the organization status to "${pendingUpdates.status}"? This action will be logged in the audit trail.`
            : "Are you sure you want to proceed with these changes?"
        }
        confirmText="Confirm"
        cancelText="Cancel"
        variant={pendingUpdates?.status === "deleted" || pendingUpdates?.status === "suspended" ? "destructive" : "default"}
        loading={updateOrganization.isPending}
      />
    </div>
  );
}


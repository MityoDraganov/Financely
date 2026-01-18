import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

interface DuplicateOrganizationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: (targetOrgId: string) => void;
}

export function DuplicateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: DuplicateOrganizationDialogProps) {
  const { data: currentOrganization } = useCurrentOrganization();
  const [targetOrgName, setTargetOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (currentOrganization?.name) {
        setTargetOrgName(`${currentOrganization.name} (Copy)`);
      }
    } else {
      setTargetOrgName("");
    }
  }, [open, currentOrganization?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !targetOrgName.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const functions = getFunctions();
      const duplicateOrganization = httpsCallable(functions, "duplicateOrganization");
      
      const result = await duplicateOrganization({
        sourceOrgId: currentOrganization.id,
        targetOrgName: targetOrgName.trim(),
        options: {
          includePrices: true,
          resetWorkflows: true,
          resetWebhooks: true,
          resetApiKeys: true,
          resetDomains: true,
          conflictResolution: "suffix",
        },
      });

      const data = result.data as { jobId: string };
      
      toast.success("Organization duplication started successfully!");
      onOpenChange(false);
      if (onSuccess) {
        // Note: We don't have targetOrgId yet, it will be available after job completes
        // For now, just close the dialog
      }
    } catch (error) {
      console.error("Failed to start duplication:", error);
      toast.error(
        error instanceof Error
          ? `Failed to duplicate organization: ${error.message}`
          : "Failed to duplicate organization"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Duplicate Organization</DialogTitle>
            <DialogDescription>
              Create a full copy of this organization with all templates, workflows, email templates, products, and other entities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                This will create a new organization with copies of all your templates, workflows, email templates, products, and other entities. 
                All identity-bound data (users, clients, invoices) will be excluded.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="targetOrgName">New Organization Name</Label>
              <Input
                id="targetOrgName"
                value={targetOrgName}
                onChange={(e) => setTargetOrgName(e.target.value)}
                placeholder="Enter organization name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !targetOrgName.trim()}>
              {isSubmitting ? (
                "Duplicating..."
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

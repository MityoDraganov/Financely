import { useState } from "react";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useCreateOrganization, useAddOrganizationMember, useUpdateUserRole, useUserByClerkId } from "@/hooks";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import { ORGANIZATION_ROLES } from "@/core/roles";
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOrganizationLogo } from "@/utils/branding";
import { cn } from "@/lib/utils";

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, isLoading, switchOrganization } = useOrganizationContext();
  const { user } = useUser();
  const { data: dbUser } = useUserByClerkId(user?.id);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createOrgName, setCreateOrgName] = useState("");
  const [createOrgDescription, setCreateOrgDescription] = useState("");
  
  const createOrganization = useCreateOrganization();
  const addMember = useAddOrganizationMember();
  const updateUserRole = useUpdateUserRole();

  const handleCreateOrganization = async () => {
    if (!createOrgName.trim()) {
      toast.error("Organization name is required");
      return;
    }

    if (!dbUser?.id) {
      toast.error("User not found. Please try again.");
      return;
    }

    try {
      const orgData = {
        name: createOrgName.trim(),
        ...(createOrgDescription.trim() && { description: createOrgDescription.trim() }),
        status: "active" as const,
        memberIds: [],
        subscription: {
          plan: "free" as const,
          status: "active" as const,
        },
        settings: {
          brandColors: {
            primary: "#2563eb",
            secondary: "#6b7280",
            accent: "#10b981",
          },
          security: {
            ssoEnabled: false,
          },
          customRoles: [],
          defaultCurrency: "USD",
          defaultLanguage: "en",
          defaultTimezone: "UTC",
          invoicePrefix: "INV",
          invoiceNumberStart: 1,
          features: {
            customTemplates: true,
            pdfGeneration: true,
            emailSending: true,
            apiAccess: false,
          },
          ai: {
            autoProposalSuggestions: false,
          },
        },
        usage: {
          templateCount: 0,
          invoiceCount: 0,
          memberCount: 0,
          storageBytes: 0,
        },
      };

      const orgId = await createOrganization.mutateAsync(orgData);

      await addMember.mutateAsync({
        organizationId: orgId,
        userId: dbUser.id,
      });

      await updateUserRole.mutateAsync({
        userId: dbUser.id,
        organizationId: orgId,
        role: ORGANIZATION_ROLES.OWNER,
      });

      toast.success("Organization created successfully!");
      setIsCreateDialogOpen(false);
      setCreateOrgName("");
      setCreateOrgDescription("");
      
      switchOrganization(orgId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create organization";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  const orgLogo = getOrganizationLogo(currentOrganization);
  const orgName = currentOrganization?.name || "Organization";

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-2 px-3 h-auto py-2",
              "hover:bg-muted/50"
            )}
          >
            {orgLogo ? (
              <img
                src={orgLogo}
                alt={orgName}
                className="h-6 w-6 rounded object-cover shrink-0"
              />
            ) : (
              <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">{orgName}</div>
              <div className="text-xs text-muted-foreground">
                {organizations.length} {organizations.length === 1 ? "organization" : "organizations"}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[280px]">
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {organizations.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No organizations found
            </div>
          ) : (
            organizations.map((org) => {
              const isSelected = currentOrganization?.id === org.id;
              const logo = getOrganizationLogo(org);
              const name = org.name || "Organization";

              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => switchOrganization(org.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 cursor-pointer",
                    isSelected && "bg-accent"
                  )}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={name}
                      className="h-5 w-5 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <span className="flex-1 text-sm truncate">{name}</span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          <DropdownMenuSeparator />
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setIsCreateDialogOpen(true);
                }}
                className="flex items-center gap-2 px-2 py-2 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Create organization</span>
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Create a new organization to manage your invoices, workflows, and team members.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name *</Label>
                  <Input
                    id="org-name"
                    placeholder="My Company"
                    value={createOrgName}
                    onChange={(e) => setCreateOrgName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-description">Description (Optional)</Label>
                  <Textarea
                    id="org-description"
                    placeholder="A brief description of your organization"
                    value={createOrgDescription}
                    onChange={(e) => setCreateOrgDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createOrganization.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOrganization}
                  disabled={!createOrgName.trim() || createOrganization.isPending}
                >
                  {createOrganization.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}


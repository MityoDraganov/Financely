import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Shield,
  Crown,
  UserCheck,
  UserX,
  Users,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useInvites } from "@/hooks/use-invites";
import { InviteUserDialog } from "@/components/invite/invite-user-dialog";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";
import { ORGANIZATION_ROLES } from "@/core/roles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useInvites as useInviteActions } from "@/hooks/useInvites";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

export default function UsersListPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { user: clerkUser } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  const { data: organization } = useCurrentOrganization();
  const {
    data: members = [],
    isLoading,
    error,
  } = useOrganizationMembers(organization?.id);
  if (error) {
    console.error("Error fetching organization members:", error);
  }
  const { data: invites = [] } = useInvites(organization?.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [memberToRevoke, setMemberToRevoke] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [memberToTransfer, setMemberToTransfer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [expirationDays, setExpirationDays] = useState(7);
  const queryClient = useQueryClient();

  const currentUserRole =
    organization?.id && dbUser?.organizationRoles
      ? dbUser.organizationRoles[organization.id]
      : undefined;
  const isOwner = currentUserRole === ORGANIZATION_ROLES.OWNER;

  const {
    invites: codeInvites = [],
    isLoading: invitesLoading,
    createInvite,
    revokeInvite,
    copyToClipboard,
    isCreating: creating,
    isRevoking,
  } = useInviteActions();

  const revokeMemberMutation = useMutation({
    mutationFn: async ({
      organizationId,
      memberId,
    }: {
      organizationId: string;
      memberId: string;
    }) => {
      return await functionsService.revokeMember({ organizationId, memberId });
    },
    onSuccess: async () => {
      toast.success(
        t("settings.users.allUsers.memberRevokedSuccess", {
          defaultValue: "Member access revoked successfully",
        })
      );
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["users"] }),
        queryClient.refetchQueries({ queryKey: ["organizations"] }),
        queryClient.refetchQueries({
          queryKey: ["organization-members", organization?.id],
        }),
      ]);
      setRevokeDialogOpen(false);
      setMemberToRevoke(null);
    },
    onError: (error: Error) => {
      console.error("Failed to revoke member:", error);
      toast.error(
        error.message.includes("permission-denied")
          ? t("settings.users.allUsers.onlyOwnerCanRevoke", {
              defaultValue: "Only organization owners can revoke members",
            })
          : t("settings.users.allUsers.revokeMemberError", {
              defaultValue: "Failed to revoke member access",
            })
      );
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async ({
      organizationId,
      newOwnerId,
    }: {
      organizationId: string;
      newOwnerId: string;
    }) => {
      return await functionsService.transferOrganizationOwnership({
        organizationId,
        newOwnerId,
      });
    },
    onSuccess: async () => {
      toast.success(
        t("settings.users.allUsers.transferOwnershipSuccess", {
          defaultValue: "Organization ownership transferred successfully",
        })
      );
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["users"] }),
        queryClient.refetchQueries({ queryKey: ["organizations"] }),
        queryClient.refetchQueries({
          queryKey: ["organization-members", organization?.id],
        }),
      ]);
      setTransferDialogOpen(false);
      setMemberToTransfer(null);
    },
    onError: (error: Error) => {
      console.error("Failed to transfer organization ownership:", error);
      toast.error(
        error.message.includes("permission-denied")
          ? t("settings.users.allUsers.onlyOwnerCanTransferOwnership", {
              defaultValue: "Only organization owners can transfer ownership",
            })
          : t("settings.users.allUsers.transferOwnershipError", {
              defaultValue: "Failed to transfer ownership",
            })
      );
    },
  });

  const handleRevokeClick = (member: {
    id: string;
    name: string;
    role: string;
  }) => {
    if (member.role === ORGANIZATION_ROLES.OWNER) {
      toast.error(
        t("settings.users.allUsers.cannotRevokeOwner", {
          defaultValue: "Cannot revoke another owner",
        })
      );
      return;
    }
    setMemberToRevoke({ id: member.id, name: member.name });
    setRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = () => {
    if (!memberToRevoke || !organization?.id) return;
    revokeMemberMutation.mutate({
      organizationId: organization.id,
      memberId: memberToRevoke.id,
    });
  };

  const handleTransferOwnershipClick = (member: {
    id: string;
    name: string;
    role: string;
  }) => {
    if (member.role === ORGANIZATION_ROLES.OWNER) {
      toast.error(
        t("settings.users.allUsers.cannotTransferToOwner", {
          defaultValue: "Selected member is already an owner",
        })
      );
      return;
    }
    setMemberToTransfer({ id: member.id, name: member.name });
    setTransferDialogOpen(true);
  };

  const handleConfirmTransferOwnership = () => {
    if (!memberToTransfer || !organization?.id) return;
    transferOwnershipMutation.mutate({
      organizationId: organization.id,
      newOwnerId: memberToTransfer.id,
    });
  };

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case ORGANIZATION_ROLES.OWNER:
        return "default" as const;
      case ORGANIZATION_ROLES.ADMIN:
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const getInviteStatusIcon = (status: string) => {
    switch (status) {
      case "active":
      case "sent":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case "used":
        return <CheckCircle className="h-3.5 w-3.5 text-blue-500" />;
      case "expired":
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
      case "revoked":
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getInviteStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-0 text-xs">
            {t("settings.users.invites.status.active")}
          </Badge>
        );
      case "used":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-0 text-xs">
            {t("settings.users.invites.status.used")}
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="text-xs">
            {t("settings.users.invites.status.expired")}
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="destructive" className="text-xs">
            {t("settings.users.invites.status.revoked")}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {t("settings.users.invites.status.unknown")}
          </Badge>
        );
    }
  };

  const isInviteExpired = (expiresAt: string) =>
    new Date(expiresAt) <= new Date();

  const adminCount = members.filter(
    (m) =>
      m.role === ORGANIZATION_ROLES.ADMIN ||
      m.role === ORGANIZATION_ROLES.OWNER
  ).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="h-72 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-4 border-b">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("settings.users.allUsers.pageTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.users.allUsers.pageDescription")}
          </p>
        </div>
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="w-full sm:w-auto shrink-0"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {t("settings.users.allUsers.inviteMember")}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none">{members.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.users.allUsers.stats.active")}
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none">{adminCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.users.allUsers.stats.admins")}
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none">{invites.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.users.allUsers.stats.pending")}
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
            <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none">
              {members.filter((m) => m.status === "suspended").length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.users.allUsers.stats.suspended")}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList className="h-auto w-full bg-transparent p-0 border-b rounded-none justify-start gap-0">
          <TabsTrigger
            value="members"
            className="relative h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent hover:text-foreground transition-colors gap-2"
          >
            <UserCheck className="h-4 w-4" />
            {t("settings.users.allUsers.title", { defaultValue: "Members" })}
          </TabsTrigger>
          <TabsTrigger
            value="invites"
            className="relative h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent hover:text-foreground transition-colors gap-2"
          >
            <Mail className="h-4 w-4" />
            {t("settings.users.invites.title", { defaultValue: "Invites" })}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-2 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("settings.users.allUsers.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Member List */}
          <div className="rounded-lg border divide-y overflow-hidden">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm mb-1">
                  {searchTerm
                    ? t("settings.users.allUsers.noMembersFound")
                    : t("settings.users.allUsers.noTeamMembers")}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm
                    ? t("settings.users.allUsers.tryAdjustingSearch")
                    : t("settings.users.allUsers.inviteFirstMember")}
                </p>
                {!searchTerm && (
                  <Button
                    size="sm"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("settings.users.allUsers.inviteMember")}
                  </Button>
                )}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 sm:p-4 bg-card hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-medium text-sm truncate">
                        {member.name}
                      </span>
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className="text-xs capitalize"
                      >
                        {member.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("settings.users.allUsers.joined", {
                        date: formatDateTable(new Date(member.createdAt)),
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-950 rounded-md">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">
                        {t("settings.users.allUsers.active")}
                      </span>
                    </div>

                    {isOwner && member.role !== ORGANIZATION_ROLES.OWNER && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTransferOwnershipClick(member)}
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            {t("settings.users.allUsers.transferOwnership", {
                              defaultValue: "Transfer Ownership",
                            })}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRevokeClick(member)}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            {t("settings.users.allUsers.removeMember", {
                              defaultValue: "Remove Member",
                            })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Invites Tab */}
        <TabsContent value="invites" className="mt-5 space-y-6">

          {/* ── Section 1: Email invitations ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {t("settings.users.invites.emailSection.title", { defaultValue: "Email invitations" })}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("settings.users.invites.emailSection.description", { defaultValue: "Invite someone directly by email address and role" })}
                </p>
              </div>
              <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                {t("settings.users.allUsers.inviteMember", { defaultValue: "Invite" })}
              </Button>
            </div>

            {invites.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 py-8 text-center">
                <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("settings.users.invites.emailSection.empty", { defaultValue: "No pending email invitations" })}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border divide-y overflow-hidden">
                {invites.map((invite: any) => (
                  <div key={invite.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-xs font-semibold">
                        {invite.email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settings.users.invites.expires", { date: formatDateTable(new Date(invite.expiresAt)) })}
                      </p>
                    </div>
                    {invite.role && (
                      <Badge variant="outline" className="text-xs capitalize shrink-0">{invite.role}</Badge>
                    )}
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-0 text-xs shrink-0">
                      {t("settings.users.allUsers.stats.pending", { defaultValue: "Pending" })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">
                {t("settings.users.invites.orDivider", { defaultValue: "or share a link" })}
              </span>
            </div>
          </div>

          {/* ── Section 2: Invite links ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {t("settings.users.invites.linkSection.title", { defaultValue: "Invite links" })}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("settings.users.invites.linkSection.description", { defaultValue: "Generate a link anyone can use to join your organization" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 h-8">
                  <Label htmlFor="expiration" className="text-xs text-muted-foreground whitespace-nowrap">
                    {t("settings.users.invites.createNewInvite.expiresIn", { defaultValue: "Expires in" })}
                  </Label>
                  <Input
                    id="expiration"
                    type="number"
                    min="1"
                    max="30"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(Number(e.target.value))}
                    className="h-6 w-10 border-0 bg-transparent p-0 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("settings.users.invites.createNewInvite.days", { defaultValue: "days" })}
                  </span>
                </div>
                <Button size="sm" onClick={() => createInvite(expirationDays)} disabled={creating}>
                  {creating ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {creating
                    ? t("settings.users.invites.createNewInvite.creating", { defaultValue: "Creating…" })
                    : t("settings.users.invites.createNewInvite.createInvite", { defaultValue: "New link" })}
                </Button>
              </div>
            </div>

            {invitesLoading ? (
              <div className="rounded-lg border divide-y overflow-hidden">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                    <div className="ml-auto h-4 w-16 bg-muted rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : codeInvites.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 py-8 text-center">
                <UserPlus className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("settings.users.invites.noInvites.title", { defaultValue: "No invite links yet" })}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t("settings.users.invites.noInvites.description", { defaultValue: "Create one above to share with your team" })}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border divide-y overflow-hidden">
                {codeInvites.map((invite) => {
                  const isActive = (invite.status === "active" || invite.status === "sent") && !isInviteExpired(invite.expiresAt);
                  return (
                    <div key={invite.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {getInviteStatusIcon(invite.status)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[180px]">
                              {invite.code}
                            </code>
                            {getInviteStatusBadge(invite.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {t("settings.users.invites.expires", { date: formatDateTable(new Date(invite.expiresAt)) })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(invite.code)} title={t("settings.users.invites.copy", { defaultValue: "Copy link" })}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isActive && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => revokeInvite(invite.id)} disabled={isRevoking} title={t("settings.users.invites.revoke", { defaultValue: "Revoke" })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      {/* Revoke Member Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.users.allUsers.confirmRevokeTitle", {
                defaultValue: "Revoke Member Access",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.users.allUsers.confirmRevokeDescription", {
                defaultValue:
                  "Are you sure you want to revoke {{name}}'s access to this organization? This action cannot be undone.",
                name: memberToRevoke?.name || "this member",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMemberMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              disabled={revokeMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeMemberMutation.isPending
                ? t("common.processing", { defaultValue: "Processing..." })
                : t("settings.users.allUsers.revokeAccess", {
                    defaultValue: "Revoke Access",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Ownership Confirmation Dialog */}
      <AlertDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.users.allUsers.confirmTransferOwnershipTitle", {
                defaultValue: "Transfer Organization Ownership",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.users.allUsers.confirmTransferOwnershipDescription", {
                defaultValue:
                  "Are you sure you want to transfer ownership to {{name}}? You will become an admin and lose owner-only permissions.",
                name: memberToTransfer?.name || "this member",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferOwnershipMutation.isPending}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTransferOwnership}
              disabled={transferOwnershipMutation.isPending}
            >
              {transferOwnershipMutation.isPending
                ? t("common.processing", { defaultValue: "Processing..." })
                : t("settings.users.allUsers.transferOwnership", {
                    defaultValue: "Transfer Ownership",
                  })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

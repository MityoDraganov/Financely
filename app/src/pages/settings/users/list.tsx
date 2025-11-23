import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Search, Plus, MoreHorizontal, Mail, Shield, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useInvites } from "@/hooks/use-invites";
import { InviteUserDialog } from "@/components/invite/invite-user-dialog";
import { PendingInvites } from "@/components/invite/pending-invites";
import { useUser } from "@clerk/clerk-react";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";
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

export default function UsersListPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { user: clerkUser } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  const { data: organization } = useCurrentOrganization();
  const { data: members = [], isLoading } = useOrganizationMembers(organization?.id);
  const { data: invites = [] } = useInvites(organization?.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [memberToRevoke, setMemberToRevoke] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // Get current user's role in the organization
  const currentUserRole = organization?.id && dbUser?.organizationRoles
    ? dbUser.organizationRoles[organization.id]
    : undefined;
  const isOwner = currentUserRole === "owner";

  // Revoke member mutation
  const revokeMemberMutation = useMutation({
    mutationFn: async ({ organizationId, memberId }: { organizationId: string; memberId: string }) => {
      return await functionsService.revokeMember({ organizationId, memberId });
    },
    onSuccess: async () => {
      toast.success(t('settings.users.allUsers.memberRevokedSuccess', { defaultValue: "Member access revoked successfully" }));
      // Invalidate all related queries - use exact match for users query
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      // Force refetch to update the UI immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["users"] }),
        queryClient.refetchQueries({ queryKey: ["organizations"] }),
        queryClient.refetchQueries({ queryKey: ["organization-members", organization?.id] }),
      ]);
      setRevokeDialogOpen(false);
      setMemberToRevoke(null);
    },
    onError: (error: Error) => {
      console.error("Failed to revoke member:", error);
      toast.error(
        error.message.includes("permission-denied")
          ? t('settings.users.allUsers.onlyOwnerCanRevoke', { defaultValue: "Only organization owners can revoke members" })
          : t('settings.users.allUsers.revokeMemberError', { defaultValue: "Failed to revoke member access" })
      );
    },
  });

  const handleRevokeClick = (member: { id: string; name: string; role: string }) => {
    if (member.role === "owner") {
      toast.error(t('settings.users.allUsers.cannotRevokeOwner', { defaultValue: "Cannot revoke another owner" }));
      return;
    }
    setMemberToRevoke({ id: member.id, name: member.name });
    setRevokeDialogOpen(true);
  };

  const handleConfirmRevoke = () => {
    if (!memberToRevoke || !organization?.id) {
      return;
    }
    revokeMemberMutation.mutate({
      organizationId: organization.id,
      memberId: memberToRevoke.id,
    });
  };

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "member":
        return "outline";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
        <div className="space-y-0.5">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('settings.users.allUsers.pageTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('settings.users.allUsers.pageDescription')}
          </p>
        </div>
        <Button 
          onClick={() => setInviteDialogOpen(true)}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('settings.users.allUsers.inviteMember')}
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('settings.users.allUsers.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t('settings.users.allUsers.allMembers', { count: filteredMembers.length })}</CardTitle>
          <CardDescription className="text-sm">
            {t('settings.users.allUsers.allMembersDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredMembers.map((member) => (
              <div key={member.id} className="p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                      <AvatarImage src={member.avatarUrl} alt={member.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{member.name}</h3>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs capitalize">
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{member.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('settings.users.allUsers.joined', { date: formatDateTable(new Date(member.createdAt)) })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-950 rounded-md">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">{t('settings.users.allUsers.active')}</span>
                    </div>
                    
                    {/* Only show dropdown menu if current user is owner and member is not owner */}
                    {isOwner && member.role !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleRevokeClick(member)}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            {t('settings.users.allUsers.removeMember', { defaultValue: "Remove Member" })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredMembers.length === 0 && (
            <div className="text-center py-8">
              <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold mb-1.5">
                {searchTerm ? t('settings.users.allUsers.noMembersFound') : t('settings.users.allUsers.noTeamMembers')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm 
                  ? t('settings.users.allUsers.tryAdjustingSearch')
                  : t('settings.users.allUsers.inviteFirstMember')
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('settings.users.allUsers.inviteMember')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{members.filter(m => m.status === "active").length}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t('settings.users.allUsers.stats.active')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{members.filter(m => m.role === "admin" || m.role === "owner").length}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t('settings.users.allUsers.stats.admins')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-orange-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{invites.length}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t('settings.users.allUsers.stats.pending')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-2.5">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">{members.filter(m => m.status === "suspended").length}</p>
                <p className="text-xs text-muted-foreground leading-tight">{t('settings.users.allUsers.stats.suspended')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites Section */}
      {invites.length > 0 && (
        <PendingInvites invites={invites} />
      )}

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
              {t('settings.users.allUsers.confirmRevokeTitle', { defaultValue: "Revoke Member Access" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.users.allUsers.confirmRevokeDescription', {
                defaultValue: "Are you sure you want to revoke {{name}}'s access to this organization? This action cannot be undone.",
                name: memberToRevoke?.name || "this member"
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMemberMutation.isPending}>
              {t('common.cancel', { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRevoke}
              disabled={revokeMemberMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeMemberMutation.isPending
                ? t('common.processing', { defaultValue: "Processing..." })
                : t('settings.users.allUsers.revokeAccess', { defaultValue: "Revoke Access" })
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

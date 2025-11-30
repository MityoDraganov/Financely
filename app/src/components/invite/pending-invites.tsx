import { useState } from "react";
import { Mail, Clock, UserX, RefreshCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Invite } from "@/core/entities/invite";
import { useRevokeInvite, useResendInvite } from "@/hooks/use-invites";
import { ORGANIZATION_ROLES } from "@/core/roles";

interface PendingInvitesProps {
  invites: Invite[];
}

export function PendingInvites({ invites }: PendingInvitesProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  
  const revokeInvite = useRevokeInvite();
  const resendInvite = useResendInvite();

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case ORGANIZATION_ROLES.ADMIN:
        return "default";
      case ORGANIZATION_ROLES.MEMBER:
        return "secondary";
      case ORGANIZATION_ROLES.VIEWER:
        return "outline";
      default:
        return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) {
      return "Expired";
    } else if (diffInDays === 0) {
      return "Expires today";
    } else if (diffInDays === 1) {
      return "Expires tomorrow";
    } else {
      return `Expires in ${diffInDays} days`;
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      await revokeInvite.mutateAsync(inviteId);
    } finally {
      setRevokingId(null);
    }
  };

  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId);
    try {
      await resendInvite.mutateAsync(inviteId);
    } finally {
      setResendingId(null);
    }
  };

  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-0.5 pb-2 border-b">
        <h3 className="text-base font-semibold">Pending Invitations</h3>
        <p className="text-sm text-muted-foreground">
          Invitations that haven't been accepted yet
        </p>
      </div>

      {/* Invites List */}
      <div className="space-y-2.5">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                <Mail className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{invite.email}</span>
                  <Badge variant={getRoleBadgeVariant(invite.role)} className="text-xs">
                    {invite.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{formatDate(invite.expiresAt)}</span>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleResend(invite.id)}
                  disabled={resendingId === invite.id}
                >
                  {resendingId === invite.id ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokingId === invite.id}
                  className="text-destructive"
                >
                  {revokingId === invite.id ? (
                    <>
                      <UserX className="mr-2 h-4 w-4 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <UserX className="mr-2 h-4 w-4" />
                      Revoke
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}

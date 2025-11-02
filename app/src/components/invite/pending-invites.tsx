import { useState } from "react";
import { Mail, Clock, UserX, RefreshCw, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Invite } from "@/core/entities/invite";
import { useRevokeInvite, useResendInvite } from "@/hooks/use-invites";

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
      case "admin":
        return "default";
      case "member":
        return "secondary";
      case "viewer":
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          Invitations that haven't been accepted yet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{invite.email}</span>
                    <Badge variant={getRoleBadgeVariant(invite.role)}>
                      {invite.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(invite.expiresAt)}
                  </div>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
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
      </CardContent>
    </Card>
  );
}

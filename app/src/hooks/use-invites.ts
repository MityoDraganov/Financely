import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inviteService } from "@/services/invite/invite-service";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { toast } from "sonner";

export function useInvites(organizationId?: string) {
  return useQuery({
    queryKey: ["invites", organizationId],
    queryFn: () => inviteService.getInvites(organizationId!),
    enabled: !!organizationId,
  });
}

export function useSendInvite() {
  const queryClient = useQueryClient();
  const authUser = useFirebaseAuthUser();

  return useMutation({
    mutationFn: async (inviteData: {
      email: string;
      role: "admin" | "member" | "viewer";
      organizationId: string;
    }) => {
      if (!authUser) {
        throw new Error("User not authenticated");
      }

      return inviteService.sendInvite({
        ...inviteData,
        invitedBy: authUser.uid,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Invite sent to ${variables.email}`);
      queryClient.invalidateQueries({ queryKey: ["invites", variables.organizationId] });
    },
    onError: (error) => {
      toast.error(`Failed to send invite: ${error.message}`);
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  const authUser = useFirebaseAuthUser();

  return useMutation({
    mutationFn: async (token: string) => {
      if (!authUser) {
        throw new Error("User not authenticated");
      }

      return inviteService.acceptInvite(token, authUser);
    },
    onSuccess: () => {
      toast.success("Successfully joined the organization!");
      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
    },
    onError: (error) => {
      toast.error(`Failed to accept invite: ${error.message}`);
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteService.revokeInvite,
    onSuccess: () => {
      toast.success("Invite revoked");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => {
      toast.error(`Failed to revoke invite: ${error.message}`);
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: inviteService.resendInvite,
    onSuccess: () => {
      toast.success("Invite resent");
    },
    onError: (error) => {
      toast.error(`Failed to resend invite: ${error.message}`);
    },
  });
}

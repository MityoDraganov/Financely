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
    mutationFn: async (code: string) => {
      if (!authUser) {
        throw new Error("User not authenticated");
      }

      // Cloud Function gets user from Firebase Auth, so we don't need to pass it
      return inviteService.acceptInvite(code, authUser);
    },
    onSuccess: (response) => {
      toast.success("Successfully joined the organization!");
      // Invalidate all organization-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["current-organization"] });
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      // Force refetch to update the UI immediately
      queryClient.refetchQueries({ queryKey: ["users"] });
      queryClient.refetchQueries({ queryKey: ["organizations"] });
      // If we have the organization ID from the response, refetch its members
      if (response?.organizationId) {
        queryClient.refetchQueries({ queryKey: ["organization-members", response.organizationId] });
      } else {
        queryClient.refetchQueries({ queryKey: ["organization-members"] });
      }
      queryClient.refetchQueries({ queryKey: ["user-organizations"] });
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
    onSuccess: (invite) => {
      toast.success("Invite revoked");
      // Invalidate and refetch the specific organization's invites query
      queryClient.invalidateQueries({ 
        queryKey: ["invites", invite.organizationId],
        refetchType: "active"
      });
    },
    onError: (error) => {
      toast.error(`Failed to revoke invite: ${error.message}`);
    },
  });
}

export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteService.resendInvite,
    onSuccess: (invite) => {
      toast.success("Invite resent");
      // Invalidate and refetch the specific organization's invites query
      queryClient.invalidateQueries({ 
        queryKey: ["invites", invite.organizationId],
        refetchType: "active"
      });
    },
    onError: (error) => {
      toast.error(`Failed to resend invite: ${error.message}`);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { toast } from "sonner";

interface Invite {
  id: string;
  code: string;
  organizationId: string;
  invitedBy: string;
  status: "active" | "sent" | "used" | "expired" | "revoked";
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateInviteParams {
  expiresAt: string;
}

interface RevokeInviteParams {
  inviteId: string;
}

export function useInvites() {
  const { getToken } = useAuth();
  const { isAuthReady } = useAuthReady();
  const queryClient = useQueryClient();
  const functions = getFunctions();
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();

  // Query for fetching invites - using repository pattern
  const {
    data: invites = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["invites", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) throw new Error("No organization selected");
      
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      // TODO: Use repository pattern instead of direct function calls
      // For now, we'll use a direct Firestore query
      // This should be replaced with proper repository usage
      const { getFirestore, collection, query, where, getDocs, orderBy } = await import("firebase/firestore");
      const db = getFirestore();
      
      const invitesQuery = query(
        collection(db, "invites"),
        where("organizationId", "==", currentOrganization.id),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(invitesQuery);
      const allInvites = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Invite));
      
      // Filter to only include active and sent invites (exclude revoked, used, expired)
      return allInvites.filter(invite => 
        invite.status === "active" || invite.status === "sent"
      );
    },
    enabled: !!currentOrganization?.id && !isOrgLoading && isAuthReady,
  });

  // Mutation for creating invites
  const createInviteMutation = useMutation({
    mutationFn: async (params: CreateInviteParams) => {
      if (!currentOrganization?.id) throw new Error("No organization selected");
      
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const createInviteFn = httpsCallable<
        { organizationId: string; expiresAt: string },
        { success: boolean; invite: Invite; message: string }
      >(functions, "createInvite");

      const result = await createInviteFn({
        ...params,
        organizationId: currentOrganization.id,
      });

      if (!result.data.success) {
        throw new Error(result.data.message || "Failed to create invite");
      }

      return result.data.invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites", currentOrganization?.id] });
      toast.success("Invite created successfully");
    },
    onError: (error) => {
      console.error("Error creating invite:", error);
      toast.error("Failed to create invite");
    },
  });

  // Mutation for revoking invites
  const revokeInviteMutation = useMutation({
    mutationFn: async (params: RevokeInviteParams) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const revokeInviteFn = httpsCallable<
        { inviteId: string },
        { success: boolean; invite: Invite; message: string }
      >(functions, "revokeInvite");

      try {
        const result = await revokeInviteFn(params);
        
        if (!result.data?.success) {
          throw new Error(result.data?.message || "Failed to revoke invite");
        }

        return result.data.invite;
      } catch (error: any) {
        // Handle Firebase Functions errors
        // Firebase Functions errors can have different structures
        let errorMessage = "Failed to revoke invite";
        
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.details) {
          errorMessage = error.details;
        } else if (typeof error === "string") {
          errorMessage = error;
        }
        
        console.error("Error revoking invite:", error);
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch the invites query
      queryClient.invalidateQueries({ 
        queryKey: ["invites", currentOrganization?.id],
        refetchType: "active"
      });
      toast.success("Invite revoked successfully");
    },
    onError: (error) => {
      console.error("Error revoking invite:", error);
      toast.error(error.message || "Failed to revoke invite");
    },
  });

  // Helper functions
  const createInvite = (expirationDays: number) => {
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();
    return createInviteMutation.mutateAsync({
      expiresAt,
    });
  };

  const revokeInvite = (inviteId: string) => {
    return revokeInviteMutation.mutateAsync({ inviteId });
  };

  const copyToClipboard = async (inviteCode: string) => {
    try {
      // Get the current domain from window.location
      const currentDomain = window.location.origin;
      
      // Create the join URL with the invite code
      const joinUrl = `${currentDomain}/accept-invite?code=${inviteCode}`;
      
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Join URL copied to clipboard");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  return {
    // Data
    invites,
    isLoading,
    error,
    
    // Actions
    createInvite,
    revokeInvite,
    copyToClipboard,
    refetch,
    
    // Mutation states
    isCreating: createInviteMutation.isPending,
    isRevoking: revokeInviteMutation.isPending,
  };
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

const PENDING_INVITE_KEY = "pendingInviteCode";

/**
 * Component that handles pending invite codes after sign-in
 * Checks sessionStorage for pending invite and redirects to accept-invite page
 */
export function PendingInviteHandler() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only check if Clerk is loaded and user is signed in
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Check for pending invite code
    const pendingCode = sessionStorage.getItem(PENDING_INVITE_KEY);
    
    if (pendingCode) {
      // Redirect to accept-invite page to process the invite
      // The accept-invite page will handle accepting it automatically
      navigate(`/accept-invite?code=${pendingCode}`, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  return null;
}


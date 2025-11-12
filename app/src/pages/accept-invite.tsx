import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAcceptInvite } from "@/hooks/use-invites";
import { useAuth } from "@clerk/clerk-react";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";

const PENDING_INVITE_KEY = "pendingInviteCode";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const firebaseAuthUser = useFirebaseAuthUser();
  const acceptInvite = useAcceptInvite();
  
  // Support both 'code' (correct) and 'token' (legacy) query parameters
  const code = searchParams.get("code") || searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token" | "checking-auth">("checking-auth");
  const hasProcessedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Step 1: Handle invite code from URL
  useEffect(() => {
    if (!code) {
      // Check sessionStorage for pending code
      const pendingCode = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (!pendingCode) {
        setStatus("no-token");
      }
      return;
    }

    // Store invite code in sessionStorage for processing after sign-in
    sessionStorage.setItem(PENDING_INVITE_KEY, code);
  }, [code]);

  // Step 2: Process invite after authentication is confirmed
  useEffect(() => {
    // Wait for Clerk to be loaded
    if (!isLoaded) {
      setStatus("checking-auth");
      return;
    }

    // If already processed or currently processing, don't process again
    if (hasProcessedRef.current || isProcessingRef.current) {
      return;
    }

    // Get pending invite code from sessionStorage or URL
    const pendingCode = sessionStorage.getItem(PENDING_INVITE_KEY);
    const inviteCode = code || pendingCode;

    // If no invite code, nothing to do
    if (!inviteCode) {
      setStatus("no-token");
      return;
    }

    // If user is not signed in, redirect to sign-in
    if (!isSignedIn) {
      setStatus("checking-auth");
      navigate("/sign-in", { replace: true });
      return;
    }

    // User is signed in with Clerk, but we need to wait for Firebase auth user
    // The ClerkAuthProvider exchanges tokens asynchronously after sign-in/sign-up
    if (isSignedIn && !firebaseAuthUser) {
      setStatus("checking-auth");
      // The effect will re-run when firebaseAuthUser becomes available
      // ClerkAuthProvider sets it after token exchange completes
      return;
    }

    // Both Clerk and Firebase auth are ready - process the invite
    if (isSignedIn && firebaseAuthUser && inviteCode && !hasProcessedRef.current && !isProcessingRef.current) {
      isProcessingRef.current = true;
      setStatus("loading");
      
      console.log("Accepting invite with code:", inviteCode, "for user:", firebaseAuthUser.uid);
      
      acceptInvite.mutateAsync(inviteCode)
        .then(() => {
          console.log("Invite accepted successfully");
          hasProcessedRef.current = true;
          isProcessingRef.current = false;
          // Clear the pending invite code
          sessionStorage.removeItem(PENDING_INVITE_KEY);
          setStatus("success");
          
          // Redirect to dashboard after showing success message
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 2000);
        })
        .catch((error) => {
          console.error("Failed to accept invite:", error);
          isProcessingRef.current = false;
          // Clear the pending invite code on error
          sessionStorage.removeItem(PENDING_INVITE_KEY);
          setStatus("error");
        });
    }
  }, [isLoaded, isSignedIn, firebaseAuthUser, code, navigate, acceptInvite]);

  // Render states
  if (status === "no-token") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invite Link</CardTitle>
            <CardDescription>
              This invite link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "checking-auth" || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle>
              {status === "checking-auth" ? "Checking Authentication" : "Accepting Invitation"}
            </CardTitle>
            <CardDescription>
              {status === "checking-auth" 
                ? "Please wait while we verify your authentication..." 
                : "Please wait while we add you to the organization..."
              }
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Failed to Accept Invite</CardTitle>
            <CardDescription>
              There was an error accepting the invitation. The link may have expired or been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                sessionStorage.removeItem(PENDING_INVITE_KEY);
                window.location.reload();
              }} 
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Welcome to the Team!</CardTitle>
            <CardDescription>
              You've successfully joined the organization. You can now access all the features and collaborate with your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>You're now part of the team</span>
            </div>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

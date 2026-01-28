import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAcceptInvite } from "@/hooks/use-invites";
import { useAuth } from "@clerk/clerk-react";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

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
          
          // Clear pre-signup store data after successful join
          const store = useOnboardingStore.getState();
          if (store.hasInProgressData()) {
            store.reset();
          }
          
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-6">
          {/* Logo/Brand */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-[#166534] dark:text-[#22c55e] tracking-tight">
              Financely
            </h1>
            <div className="h-1 w-24 bg-[#166534] dark:bg-[#22c55e] mx-auto rounded-full" />
          </div>

          {/* Spinner */}
          <div className="flex justify-center pt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-[#166534] dark:border-t-[#22c55e]" />
          </div>

          {/* Status Message */}
          <div className="h-8 flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">
              {status === "checking-auth" 
                ? "Verifying your authentication..." 
                : "Accepting your invitation..."
              }
            </p>
          </div>
        </div>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-6">
          {/* Logo/Brand */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-[#166534] dark:text-[#22c55e] tracking-tight">
              Financely
            </h1>
            <div className="h-1 w-24 bg-[#166534] dark:bg-[#22c55e] mx-auto rounded-full" />
          </div>

          {/* Success Icon */}
          <div className="flex justify-center pt-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-10 w-10 text-[#166534] dark:text-[#22c55e]" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Welcome to the Team!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium max-w-md mx-auto">
              You've successfully joined the organization. You can now access all the features and collaborate with your team.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Users className="h-4 w-4" />
              <span>You're now part of the team</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <Button 
              onClick={() => navigate("/dashboard")} 
              className="bg-[#166534] hover:bg-[#14532d] dark:bg-[#22c55e] dark:hover:bg-[#16a34a] text-white px-8 py-2"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

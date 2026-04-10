import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { AlertCircle, CheckCircle2, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { functionsService } from "@/services/functions/functions-service";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";

type TransferDetails = {
  id: string;
  organizationId: string;
  organizationName: string;
  targetEmail: string;
  requestedByName: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: string;
  isExpired: boolean;
};

export default function AcceptOrganizationTransferPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const firebaseAuthUser = useFirebaseAuthUser();

  const [details, setDetails] = useState<TransferDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(false);

  const redirectUrl = useMemo(
    () => `/accept-organization-transfer?token=${encodeURIComponent(token)}`,
    [token],
  );

  useEffect(() => {
    if (!token) {
      setError("Missing transfer token.");
      setIsLoading(false);
      return;
    }
    if (!isLoaded) return;

    if (!isSignedIn) {
      navigate(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`, {
        replace: true,
      });
      return;
    }
    if (!firebaseAuthUser) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    functionsService
      .getOrganizationOwnershipTransferDetails({ token })
      .then((result) => {
        if (!isMounted) return;
        setDetails(result.transfer);
        if (result.transfer.status !== "pending" || result.transfer.isExpired) {
          setError(
            result.transfer.status === "accepted"
              ? "This transfer was already accepted."
              : result.transfer.status === "cancelled"
                ? "This transfer was cancelled."
                : "This transfer has expired.",
          );
        }
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load transfer details.";
        setError(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseAuthUser, isLoaded, isSignedIn, navigate, redirectUrl, token]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    setError(null);
    setEmailMismatch(false);
    try {
      await functionsService.acceptOrganizationOwnershipTransfer({ token });
      setIsAccepted(true);
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (acceptError) {
      const message =
        acceptError instanceof Error
          ? acceptError.message
          : "Failed to accept transfer.";
      setError(message);
      const normalized = message.toLowerCase();
      if (
        normalized.includes("different email") ||
        normalized.includes("permission-denied")
      ) {
        setEmailMismatch(true);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await clerk.signOut({
      redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading transfer details...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Ownership transferred
            </CardTitle>
            <CardDescription>
              You are now the owner of {details?.organizationName || "this organization"}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Accept organization ownership transfer</CardTitle>
          <CardDescription>
            Review the details below before accepting ownership.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <p>
              <span className="font-medium">Organization:</span>{" "}
              {details?.organizationName || "Unknown"}
            </p>
            <p>
              <span className="font-medium">Requested by:</span>{" "}
              {details?.requestedByName || "Unknown"}
            </p>
            <p>
              <span className="font-medium">Transfer target email:</span>{" "}
              {details?.targetEmail || "Unknown"}
            </p>
            <p>
              <span className="font-medium">Signed in as:</span>{" "}
              {clerkUser?.primaryEmailAddress?.emailAddress || "Unknown"}
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
              {emailMismatch ? (
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div>{error}</div>
            </div>
          )}

          {emailMismatch && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleSwitchAccount}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out and switch account
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={
                isAccepting ||
                Boolean(error) ||
                details?.status !== "pending" ||
                details?.isExpired
              }
              onClick={handleAccept}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept transfer"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

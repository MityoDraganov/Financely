import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useAdminRole } from "@/utils/admin-utils";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function UnauthorizedScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md p-6">
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">
          You do not have admin privileges to access this panel.
        </p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact your administrator.
        </p>
      </div>
    </div>
  );
}

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

/**
 * Protected route component for admin pages
 * Verifies user has admin role via Clerk metadata
 * Standalone admin app - no redirects to main app
 */
export function AdminProtectedRoute({
  children,
  // requiredPermission, // TODO: Implement permission checking when needed
}: AdminProtectedRouteProps) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const adminRole = useAdminRole();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // Redirect to sign-in if not authenticated
    if (!isSignedIn) {
      navigate("/sign-in", { replace: true });
      return;
    }

    // If authenticated but not an admin, show unauthorized
    // (We'll handle this in the render below)
  }, [isLoaded, isSignedIn, adminRole, navigate]);

  // Show loading state while checking authentication
  if (!isLoaded) {
    return <LoadingScreen />;
  }

  // If not signed in, redirect to sign-in (handled by useEffect)
  if (!isSignedIn) {
    return <LoadingScreen />;
  }

  // If not an admin, show unauthorized message
  if (adminRole === null) {
    return <UnauthorizedScreen />;
  }

  // User is authenticated and has admin role, render the protected content
  return <>{children}</>;
}


import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useOnboardingStatus } from "@/hooks/use-onboarding";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { needsOnboarding, isLoading } = useOnboardingStatus();

  useEffect(() => {
    // Redirect to sign-in if not authenticated
    if (isLoaded && !isSignedIn) {
      navigate("/sign-in", { replace: true });
      return;
    }

    // Only redirect if we're not already on the onboarding page
    if (isLoaded && isSignedIn && !isLoading && needsOnboarding && !window.location.pathname.includes('/onboarding')) {
      navigate("/onboarding", { replace: true });
    }
  }, [isLoaded, isSignedIn, isLoading, needsOnboarding, navigate]);

  // Show loading state while checking authentication and onboarding status
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#166534] mx-auto" />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // If not signed in, don't render children (redirect will happen)
  if (!isSignedIn) {
    return null;
  }

  // If user needs onboarding, don't render children (redirect will happen)
  if (needsOnboarding) {
    return null;
  }

  // User is authenticated and properly onboarded, render the protected content
  return <>{children}</>;
}

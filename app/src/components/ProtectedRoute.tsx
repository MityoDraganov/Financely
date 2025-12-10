import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useOnboardingStatus } from "@/hooks/use-onboarding";
import { LoadingScreen } from "./loading-screen";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { needsOnboarding, isLoading } = useOnboardingStatus();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Reset redirect flag when location changes
    hasRedirectedRef.current = false;
  }, [location.pathname]);

  useEffect(() => {
    // Don't redirect if we've already redirected or are still loading
    if (hasRedirectedRef.current || isLoading || !isLoaded) {
      return;
    }

    // Redirect to sign-in if not authenticated
    if (!isSignedIn) {
      hasRedirectedRef.current = true;
      navigate("/sign-in", { replace: true });
      return;
    }

    const isOnOnboardingPage = location.pathname === "/onboarding";
    
    // Only redirect to onboarding if:
    // 1. User is signed in
    // 2. Not already on onboarding page
    // 3. Not loading (all data loaded)
    // 4. needsOnboarding is true (hook guarantees this means user has no orgs)
    if (isSignedIn && !isOnOnboardingPage && !isLoading && needsOnboarding) {
      hasRedirectedRef.current = true;
      navigate("/onboarding", { replace: true });
    }
  }, [isLoaded, isSignedIn, isLoading, needsOnboarding, navigate, location.pathname]);

  // Show loading state while checking authentication and onboarding status
  if (!isLoaded || isLoading) {
    return <LoadingScreen />;
  }

  // If not signed in, show loading (redirect will happen)
  if (!isSignedIn) {
    return <LoadingScreen />;
  }

  // If user needs onboarding and we're not on onboarding page, show loading (redirect will happen)
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <LoadingScreen />;
  }

  // User is authenticated and properly onboarded, render the protected content
  return <>{children}</>;
}

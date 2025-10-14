import { useAuth, useUser } from "@clerk/clerk-react";
import * as React from "react";
import { useEffect } from "react";
import { useAuthStore } from "@/hooks/service-hooks/auth/use-auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { firebase } from "@/infrastructure";

export function ClerkAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const setAuthUser = useAuthStore((state) => state.setAuthUser);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!userId || !user) {
      setAuthUser(null);
      return;
    }

    // Exchange Clerk token for Firebase token
    const exchangeTokens = async () => {
      try {
        // Get Clerk session token
        const clerkToken = await getToken();
        if (!clerkToken) {
          console.error("No Clerk token available");
          return;
        }

        // Call Firebase function to verify Clerk token and get Firebase token
        const functions = getFunctions(firebase.app);
        const verifyClerkToken = httpsCallable(functions, "verifyClerkToken");
        
        const result = await verifyClerkToken({ clerkToken });
        const { firebaseToken } = result.data as { firebaseToken: string };

        // Sign in to Firebase with the custom token
        await signInWithCustomToken(firebase.auth, firebaseToken);

        // Create AuthUser from Clerk user data
        const authUser = {
          uid: userId,
          email: user.primaryEmailAddress?.emailAddress || "",
          emailVerified: user.primaryEmailAddress?.verification?.status === "verified",
          displayName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          photoURL: user.imageUrl || "",
          isTrueAdmin: false, // You can implement admin logic based on Clerk metadata
        };

        setAuthUser(authUser);
      } catch (error) {
        console.error("Error exchanging Clerk token for Firebase token:", error);
        // Still set the user for basic functionality, but Firebase operations may fail
        const authUser = {
          uid: userId,
          email: user.primaryEmailAddress?.emailAddress || "",
          emailVerified: user.primaryEmailAddress?.verification?.status === "verified",
          displayName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          photoURL: user.imageUrl || "",
          isTrueAdmin: false,
        };
        setAuthUser(authUser);
      }
    };

    exchangeTokens();
  }, [isLoaded, userId, user, getToken, setAuthUser]);

  return <>{children}</>;
}

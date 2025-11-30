import { useAuth } from "@clerk/clerk-react";
import { useFirebaseAuthUser } from "./service-hooks/auth/use-auth";
import { firebase } from "@/infrastructure";
import { useEffect, useState } from "react";

/**
 * Centralized hook to check if authentication is fully ready
 * Returns true when both Clerk and Firebase Auth are ready
 */
export function useAuthReady() {
  const { isLoaded: isClerkLoaded, isSignedIn, userId } = useAuth();
  const firebaseAuthUser = useFirebaseAuthUser();
  const [firebaseCurrentUser, setFirebaseCurrentUser] = useState(firebase.auth.currentUser);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = firebase.auth.onAuthStateChanged((user) => {
      setFirebaseCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  if (!isClerkLoaded) {
    return { isAuthReady: false, isClerkLoaded, isSignedIn, firebaseAuthUser };
  }

  if (!isSignedIn) {
    return { isAuthReady: true, isClerkLoaded, isSignedIn, firebaseAuthUser };
  }

  // If signed in, Firebase Auth must be authenticated with matching userId
  const isAuthReady = firebaseCurrentUser !== null && firebaseCurrentUser.uid === userId;
  
  return { isAuthReady, isClerkLoaded, isSignedIn, firebaseAuthUser };
}


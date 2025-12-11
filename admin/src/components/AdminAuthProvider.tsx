import { useAuth, useUser } from "@clerk/clerk-react";
import * as React from "react";
import { useEffect, useRef } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { firebase } from "@/infrastructure/firebase";

/**
 * Admin Auth Provider
 * Exchanges Clerk token (from admin Clerk instance) for Firebase token
 * Includes admin role in Firebase Auth custom claims for Firestore rules
 */
export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const isExchangingRef = useRef(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebase.auth, (firebaseUser) => {
      console.log('[ADMIN AUTH] Firebase Auth state changed:', {
        hasFirebaseUser: !!firebaseUser,
        firebaseUid: firebaseUser?.uid,
        clerkUserId: userId,
        matches: firebaseUser?.uid === userId,
      });
    });

    return () => unsubscribe();
  }, [userId]);

  // Exchange Clerk token for Firebase token when user signs in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    // Check if already signed in to Firebase
    const currentUser = firebase.auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      console.log('[ADMIN AUTH] Already authenticated with Firebase');
      return;
    }

    // Prevent multiple simultaneous exchanges
    if (isExchangingRef.current) {
      return;
    }

    // Exchange Clerk token for Firebase token
    const exchangeTokens = async () => {
      isExchangingRef.current = true;
      console.log('[ADMIN AUTH] Starting token exchange for admin Clerk user:', userId);
      
      try {
        // Get Clerk session token
        const clerkToken = await getToken();
        if (!clerkToken) {
          console.error('[ADMIN AUTH] No Clerk token available');
          isExchangingRef.current = false;
          return;
        }
        console.log('[ADMIN AUTH] Got Clerk token, length:', clerkToken.length);

        // Call Firebase function to verify admin Clerk token and get Firebase token
        const functions = getFunctions(firebase.app);
        const verifyAdminClerkToken = httpsCallable(functions, "verifyAdminClerkToken");
        
        console.log('[ADMIN AUTH] Calling verifyAdminClerkToken function...');
        const result = await verifyAdminClerkToken({ clerkToken });
        const { firebaseToken, adminRole } = result.data as { 
          firebaseToken: string;
          adminRole: string | null;
        };

        if (!firebaseToken) {
          throw new Error("No Firebase token received");
        }
        console.log('[ADMIN AUTH] Got Firebase custom token with admin role:', adminRole);

        // Sign in to Firebase with the custom token
        console.log('[ADMIN AUTH] Signing in to Firebase Auth...');
        await signInWithCustomToken(firebase.auth, firebaseToken);
        
        // Verify sign-in
        const signedInUser = firebase.auth.currentUser;
        if (signedInUser && signedInUser.uid === userId) {
          console.log('[ADMIN AUTH] Successfully signed in to Firebase Auth:', {
            uid: signedInUser.uid,
            email: signedInUser.email,
            adminRole: adminRole || 'none',
          });
        } else {
          console.warn('[ADMIN AUTH] Sign-in completed but user mismatch:', {
            expected: userId,
            actual: signedInUser?.uid,
          });
        }
      } catch (error) {
        console.error('[ADMIN AUTH] Token exchange failed:', error);
      } finally {
        isExchangingRef.current = false;
      }
    };

    // Small delay to ensure Clerk is fully ready
    const timeoutId = setTimeout(() => {
      exchangeTokens();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [isLoaded, isSignedIn, userId, getToken, user]);

  return <>{children}</>;
}


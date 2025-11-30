import { useAuth, useUser } from "@clerk/clerk-react";
import * as React from "react";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/hooks/service-hooks/auth/use-auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { firebase } from "@/infrastructure";

export function ClerkAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, userId, getToken } = useAuth();
  const { user } = useUser();
  const setAuthUser = useAuthStore((state) => state.setAuthUser);
  const isExchangingRef = useRef(false);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebase.auth, (firebaseUser) => {
      console.log('[AUTH DEBUG] Firebase Auth state changed:', {
        hasFirebaseUser: !!firebaseUser,
        firebaseUid: firebaseUser?.uid,
        clerkUserId: userId,
        matches: firebaseUser?.uid === userId,
      });

      if (firebaseUser && userId && firebaseUser.uid === userId) {
        // Firebase Auth is ready
        const authUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || user?.primaryEmailAddress?.emailAddress || "",
          emailVerified: firebaseUser.emailVerified || false,
          displayName: firebaseUser.displayName || user?.fullName || "",
          photoURL: firebaseUser.photoURL || user?.imageUrl || "",
          isTrueAdmin: false,
        };
        setAuthUser(authUser);
        console.log('[AUTH DEBUG] ✅ Firebase Auth authenticated:', authUser.uid);
      } else if (!firebaseUser) {
        // User signed out
        setAuthUser(null);
        console.log('[AUTH DEBUG] ❌ Firebase Auth signed out');
      } else {
        console.warn('[AUTH DEBUG] ⚠️ Firebase Auth user mismatch:', {
          firebaseUid: firebaseUser?.uid,
          clerkUserId: userId,
        });
      }
    });

    return () => unsubscribe();
  }, [userId, user, setAuthUser]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!userId || !user) {
      setAuthUser(null);
      // Sign out from Firebase if Clerk user is not available
      if (firebase.auth.currentUser) {
        firebase.auth.signOut().catch(() => {
          // Silent fail
        });
      }
      return;
    }

    // Check if already signed in to Firebase with correct user
    const currentUser = firebase.auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      // Already signed in, no need to exchange tokens
      return;
    }

    // Prevent multiple simultaneous token exchanges
    if (isExchangingRef.current) {
      return;
    }

    // Exchange Clerk token for Firebase token
    const exchangeTokens = async () => {
      isExchangingRef.current = true;
      console.log('[AUTH DEBUG] 🔄 Starting token exchange for Clerk user:', userId);
      
      try {
        // Get Clerk session token
        const clerkToken = await getToken();
        if (!clerkToken) {
          console.error('[AUTH DEBUG] ❌ No Clerk token available');
          isExchangingRef.current = false;
          return;
        }
        console.log('[AUTH DEBUG] ✅ Got Clerk token, length:', clerkToken.length);

        // Call Firebase function to verify Clerk token and get Firebase token
        const functions = getFunctions(firebase.app);
        const verifyClerkToken = httpsCallable(functions, "verifyClerkToken");
        
        console.log('[AUTH DEBUG] 📞 Calling verifyClerkToken function...');
        const result = await verifyClerkToken({ clerkToken });
        const { firebaseToken } = result.data as { firebaseToken: string };

        if (!firebaseToken) {
          throw new Error("No Firebase token received");
        }
        console.log('[AUTH DEBUG] ✅ Got Firebase custom token, length:', firebaseToken.length);

        // Sign in to Firebase with the custom token
        console.log('[AUTH DEBUG] 🔐 Signing in to Firebase Auth...');
        await signInWithCustomToken(firebase.auth, firebaseToken);
        
        // Verify sign-in
        const signedInUser = firebase.auth.currentUser;
        if (signedInUser && signedInUser.uid === userId) {
          console.log('[AUTH DEBUG] ✅ Successfully signed in to Firebase Auth:', {
            uid: signedInUser.uid,
            email: signedInUser.email,
          });
        } else {
          console.warn('[AUTH DEBUG] ⚠️ Sign-in completed but user mismatch:', {
            expected: userId,
            actual: signedInUser?.uid,
          });
        }
      } catch (error) {
        console.error('[AUTH DEBUG] ❌ Token exchange failed:', error);
        if (error instanceof Error) {
          console.error('[AUTH DEBUG] Error details:', {
            message: error.message,
            stack: error.stack,
          });
        }
      } finally {
        isExchangingRef.current = false;
      }
    };

    exchangeTokens();
  }, [isLoaded, userId, user, getToken, setAuthUser]);

  return <>{children}</>;
}

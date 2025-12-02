import { firebase } from "@/infrastructure";

/**
 * Debug utility to check Firebase Auth state
 * Call this from browser console: window.debugAuth()
 */
export function debugAuth() {
  const currentUser = firebase.auth.currentUser;
  
  console.group('🔍 Firebase Auth Debug');
  console.log('Current User:', currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email,
    emailVerified: currentUser.emailVerified,
    displayName: currentUser.displayName,
    metadata: {
      creationTime: currentUser.metadata.creationTime,
      lastSignInTime: currentUser.metadata.lastSignInTime,
    },
  } : '❌ No user signed in');
  
  console.log('Auth State:', {
    currentUser: currentUser?.uid || null,
    isAuthenticated: currentUser !== null,
  });
  
  // Check Firestore connection
  console.log('Firestore:', {
    app: firebase.app.name,
    projectId: firebase.app.options.projectId,
  });
  
  console.groupEnd();
  
  return {
    currentUser: currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
    } : null,
    isAuthenticated: currentUser !== null,
  };
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuth;
}



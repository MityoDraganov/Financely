import { AuthenticationService } from "@/core";

// Clerk-based authentication service
// Note: Most authentication is handled by Clerk directly
// This service provides compatibility with existing code
export const authenticationService: AuthenticationService = {
  async signUpWithEmailAndPassword() {
    // Clerk handles sign up through their components
    // This method is kept for compatibility but should not be used
    throw new Error("Use Clerk's SignUp component instead of this method");
  },

  async signInWithCustomToken() {
    // Clerk handles custom token sign in through their components
    // This method is kept for compatibility but should not be used
    throw new Error("Use Clerk's SignIn component instead of this method");
  },

  async signInWithEmailAndPassword() {
    // Clerk handles sign in through their components
    // This method is kept for compatibility but should not be used
    throw new Error("Use Clerk's SignIn component instead of this method");
  },

  onUserStateChanged() {
    // This is handled by ClerkAuthProvider
    // Return a no-op unsubscribe function
    return () => {};
  },

  async sendPasswordResetEmail() {
    // Clerk handles password reset through their components
    // This method is kept for compatibility but should not be used
    throw new Error("Use Clerk's password reset flow instead of this method");
  },

  async signOut() {
    // This would need to be called from a component with useClerk hook
    throw new Error("Use Clerk's signOut from useClerk hook instead of this method");
  },
};

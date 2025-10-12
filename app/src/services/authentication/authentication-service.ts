import { AuthenticationService, AuthUser } from "@/core";
import { firebase } from "@/infrastructure";
import {
  createUserWithEmailAndPassword,
  IdTokenResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "@firebase/auth";

export const authenticationService: AuthenticationService = {
  async signUpWithEmailAndPassword({ email, password }) {
    await createUserWithEmailAndPassword(firebase.auth, email, password);
  },

  async signInWithCustomToken(token: string) {
    await signInWithCustomToken(firebase.auth, token);
  },

  async signInWithEmailAndPassword({ email, password }) {
    await signInWithEmailAndPassword(firebase.auth, email, password);
  },

  onUserStateChanged(callback) {
    return onAuthStateChanged(firebase.auth, async (user) => {
      if (!user) {
        callback(null);
        return;
      }

      const token = await user.getIdTokenResult();
      callback(createAuthUser(user, token));
    });
  },

  async sendPasswordResetEmail(email) {
    await sendPasswordResetEmail(firebase.auth, email);
  },

  async signOut() {
    await signOut(firebase.auth);
  },
};

function createAuthUser(
  user: User | null,
  token: IdTokenResult,
): AuthUser | null {
  if (!user) {
    return null;
  }

  if (!user.uid) {
    return null;
  }

  if (!user.email) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    isTrueAdmin: Boolean(token.claims.admin) || false,
  };
}

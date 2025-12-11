import { AuthUser } from "@/core/entities/auth-user";

export interface AuthenticationService {
  signUpWithEmailAndPassword: (data: { email: string; password: string }) => Promise<void>;
  signInWithCustomToken: (token: string) => Promise<void>;
  signInWithEmailAndPassword: (data: { email: string; password: string }) => Promise<void>;
  onUserStateChanged: (callback: (user: AuthUser | null) => void) => () => void;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

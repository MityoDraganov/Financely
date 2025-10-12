export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string;
  isTrueAdmin: boolean;
}

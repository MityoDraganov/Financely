import { getAuth } from "firebase-admin/auth";
import { getFirestore, Settings, Firestore } from "firebase-admin/firestore";
import { Auth } from "firebase-admin/auth";

// Configure Firestore to ignore undefined properties
const firestoreSettings: Settings = {
  ignoreUndefinedProperties: true,
};

let _firestore: Firestore | null = null;
let _auth: Auth | null = null;

export const firestore = (): Firestore => {
  if (!_firestore) {
    _firestore = getFirestore();
    _firestore.settings(firestoreSettings);
  }
  return _firestore;
};

export const auth = (): Auth => {
  if (!_auth) {
    _auth = getAuth();
  }
  return _auth;
};

import { getAuth } from "firebase-admin/auth";
import { getFirestore, Settings } from "firebase-admin/firestore";

// Configure Firestore to ignore undefined properties
const firestoreSettings: Settings = {
  ignoreUndefinedProperties: true,
};

export const firestore = getFirestore();
firestore.settings(firestoreSettings);
export const auth = getAuth();

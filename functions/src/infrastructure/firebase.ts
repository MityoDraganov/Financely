import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Initialize Firebase app
 */
if (!getApps().length) {
  initializeApp();
}

export const firestore = getFirestore();

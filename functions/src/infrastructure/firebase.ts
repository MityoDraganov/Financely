import { getApps, getApp, initializeApp } from "firebase-admin/app";
import admin from "firebase-admin";

/**
 * Initialize Firebase app
 */
if (!getApps().length) {
  initializeApp();
}

// Best-effort environment visibility to diagnose project/database mismatches
try {
  const app = getApp();
  const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
  // eslint-disable-next-line no-console
  console.log("firestore:init", {
    projectId:
      app.options.projectId || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    firebaseConfigDefined: Boolean(process.env.FIREBASE_CONFIG),
    databaseId,
  });
} catch {
  // ignore
}

export const firestore = admin.firestore(getApp());

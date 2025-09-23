"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Initialize Firebase app
 */
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
// Best-effort environment visibility to diagnose project/database mismatches
try {
    const app = (0, app_1.getApp)();
    // eslint-disable-next-line no-console
    console.log("firestore:init", {
        projectId: app.options.projectId || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
        firebaseConfigDefined: Boolean(process.env.FIREBASE_CONFIG),
        databaseId: "(default)",
    });
}
catch (_a) {
    // ignore
}
exports.firestore = (0, firestore_1.getFirestore)();
//# sourceMappingURL=firebase.js.map
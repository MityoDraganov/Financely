import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const firestore = getFirestore();
export const auth = getAuth();

import {
  DatabaseService,
  AnalyticsConfig,
  AnalyticsConfigData,
} from "@/core";
import { AnalyticsConfigRepository } from "@/core/ports/repositories/analytics-config-repository";
import { firebase } from "@/infrastructure/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "@firebase/firestore";

const ANALYTICS_CONFIG_DOC_ID = "default";

/**
 * Factory for an `AnalyticsConfigRepository` backed by the provided `DatabaseService`.
 * Stores config as a subcollection document: organizations/{orgId}/analyticsConfig/default
 *
 * @param {DatabaseService} _databaseService - Abstraction over the database layer (unused, kept for interface compatibility).
 * @return {AnalyticsConfigRepository} Repository with CRUD operations for analytics config.
 */
export function getAnalyticsConfigRepository(
  _databaseService: DatabaseService,
): AnalyticsConfigRepository {
  return {
    async get(orgId: string): Promise<AnalyticsConfig | null> {
      const docRef = doc(
        firebase.firestore,
        `organizations/${orgId}/analyticsConfig`,
        ANALYTICS_CONFIG_DOC_ID,
      );
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
      } as AnalyticsConfig;
    },

    async set(orgId: string, data: AnalyticsConfigData): Promise<void> {
      const docRef = doc(
        firebase.firestore,
        `organizations/${orgId}/analyticsConfig`,
        ANALYTICS_CONFIG_DOC_ID,
      );
      await setDoc(docRef, {
        ...data,
        orgId,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },

    async update(orgId: string, data: Partial<AnalyticsConfigData>): Promise<void> {
      const docRef = doc(
        firebase.firestore,
        `organizations/${orgId}/analyticsConfig`,
        ANALYTICS_CONFIG_DOC_ID,
      );
      
      // Check if document exists, if not use setDoc with merge
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) {
        // Document doesn't exist, create it with setDoc
        await setDoc(docRef, {
          ...data,
          orgId,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      } else {
        // Document exists, update it
        await updateDoc(docRef, {
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }
    },

    async delete(orgId: string): Promise<void> {
      const docRef = doc(
        firebase.firestore,
        `organizations/${orgId}/analyticsConfig`,
        ANALYTICS_CONFIG_DOC_ID,
      );
      await deleteDoc(docRef);
    },
  };
}


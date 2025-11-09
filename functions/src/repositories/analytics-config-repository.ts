import { DatabaseService } from "../core";
import { AnalyticsConfig, AnalyticsConfigData } from "../core/entities/analytics-config";
import { AnalyticsConfigRepository } from "../core/ports/repositories/analytics-config-repository";
import { firestore } from "firebase-admin";

const ANALYTICS_CONFIG_DOC_ID = "default";

/**
 * Factory for an `AnalyticsConfigRepository` backed by the provided `DatabaseService`.
 * Stores config as a subcollection document: organizations/{orgId}/analyticsConfig/default
 */
export function getAnalyticsConfigRepository(
  databaseService: DatabaseService,
): AnalyticsConfigRepository {
  return {
    async get(orgId: string): Promise<AnalyticsConfig | null> {
      const docRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsConfig")
        .doc(ANALYTICS_CONFIG_DOC_ID);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return null;
      }

      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
      } as AnalyticsConfig;
    },

    async set(orgId: string, data: AnalyticsConfigData): Promise<void> {
      const docRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsConfig")
        .doc(ANALYTICS_CONFIG_DOC_ID);
      await docRef.set({
        ...data,
        orgId,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    },

    async update(orgId: string, data: Partial<AnalyticsConfigData>): Promise<void> {
      const docRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsConfig")
        .doc(ANALYTICS_CONFIG_DOC_ID);
      
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        await docRef.set({
          ...data,
          orgId,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      } else {
        await docRef.update({
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }
    },

    async delete(orgId: string): Promise<void> {
      const docRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsConfig")
        .doc(ANALYTICS_CONFIG_DOC_ID);
      await docRef.delete();
    },
  };
}


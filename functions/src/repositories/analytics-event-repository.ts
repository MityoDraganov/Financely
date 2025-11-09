import { DatabaseService } from "../core";
import { AnalyticsEventData } from "../core/entities/analytics-event";
import { AnalyticsEventRepository } from "../core/ports/repositories/analytics-event-repository";
import { firestore } from "firebase-admin";

/**
 * Factory for an `AnalyticsEventRepository` backed by the provided `DatabaseService`.
 * Stores events as subcollection documents: organizations/{orgId}/analyticsEvents/{eventId}
 */
export function getAnalyticsEventRepository(
  databaseService: DatabaseService,
): AnalyticsEventRepository {
  return {
    async create(orgId: string, data: AnalyticsEventData): Promise<string> {
      const collectionRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("analyticsEvents");

      const docRef = await collectionRef.add({
        ...data,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

      return docRef.id;
    },
  };
}


import { DatabaseService } from "@/core";
import {
  AuditLog,
  AuditLogData,
  AuditLogQueryFilters,
} from "@/core/entities/audit-log";
import { AuditLogRepository } from "@/core/ports/repositories/audit-log-repository";
import { firebase } from "@/infrastructure/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  serverTimestamp,
} from "@firebase/firestore";

/**
 * Factory for an `AuditLogRepository` backed by the provided `DatabaseService`.
 * Stores audit logs as subcollection documents: organizations/{orgId}/auditLogs/{logId}
 * Frontend version using Firestore client SDK
 */
export function getAuditLogRepository(
  _databaseService: DatabaseService,
): AuditLogRepository {
  return {
    async create(orgId: string, data: AuditLogData): Promise<string> {
      const collectionRef = collection(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs"
      );

      const timestamp = data.timestamp || new Date().toISOString();

      const docRef = await addDoc(collectionRef, {
        ...data,
        timestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    },

    async get(orgId: string, id: string): Promise<AuditLog | null> {
      const docRef = doc(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs",
        id
      );

      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      if (!data) {
        return null;
      }

      // Convert Firestore timestamps to ISO strings
      const timestamp =
        data.timestamp ||
        (data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt?.toISOString?.() || new Date().toISOString());

      return {
        id: docSnap.id,
        ...data,
        timestamp,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        updatedAt:
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
      } as AuditLog;
    },

    async query(
      orgId: string,
      filters: AuditLogQueryFilters,
      options?: {
        limit?: number;
        offset?: number;
        orderBy?: { field: string; direction: "asc" | "desc" };
      },
    ): Promise<{ logs: AuditLog[]; total: number }> {
      const collectionRef = collection(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs"
      );

      const constraints: any[] = [];

      // Apply filters
      if (filters.userId) {
        constraints.push(where("user.userId", "==", filters.userId));
      }

      if (filters.action) {
        constraints.push(where("action", "==", filters.action));
      }

      if (filters.severity) {
        constraints.push(where("severity", "==", filters.severity));
      }

      if (filters.resourceType) {
        constraints.push(where("resource.type", "==", filters.resourceType));
      }

      if (filters.resourceId) {
        constraints.push(where("resource.id", "==", filters.resourceId));
      }

      if (filters.status) {
        constraints.push(where("outcome.status", "==", filters.status));
      }

      if (filters.startDate) {
        constraints.push(where("timestamp", ">=", filters.startDate));
      }

      if (filters.endDate) {
        constraints.push(where("timestamp", "<=", filters.endDate));
      }

      if (filters.tags && filters.tags.length > 0) {
        constraints.push(where("metadata.tags", "array-contains-any", filters.tags));
      }

      // Apply ordering
      const orderByField = options?.orderBy?.field || "timestamp";
      const orderByDirection = options?.orderBy?.direction || "desc";
      constraints.push(orderBy(orderByField, orderByDirection));

      // Apply limit
      if (options?.limit) {
        constraints.push(limit(options.limit));
      }

      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);

      const logs = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const timestamp =
          data.timestamp ||
          (data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt?.toISOString?.() || new Date().toISOString());

        return {
          id: docSnap.id,
          ...data,
          timestamp,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
        } as AuditLog;
      });

      // For total count, we need a separate count query
      // Firestore doesn't support count efficiently, so we'll approximate
      const total = logs.length;

      return { logs, total };
    },

    async getByResource(
      orgId: string,
      resourceType: string,
      resourceId: string,
      options?: {
        limit?: number;
        offset?: number;
      },
    ): Promise<AuditLog[]> {
      const collectionRef = collection(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs"
      );

      const constraints: any[] = [
        where("resource.type", "==", resourceType),
        where("resource.id", "==", resourceId),
        orderBy("timestamp", "desc"),
      ];

      if (options?.limit) {
        constraints.push(limit(options.limit));
      }

      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const timestamp =
          data.timestamp ||
          (data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt?.toISOString?.() || new Date().toISOString());

        return {
          id: docSnap.id,
          ...data,
          timestamp,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
        } as AuditLog;
      });
    },

    async getByUser(
      orgId: string,
      userId: string,
      options?: {
        limit?: number;
        offset?: number;
      },
    ): Promise<AuditLog[]> {
      const collectionRef = collection(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs"
      );

      const constraints: any[] = [
        where("user.userId", "==", userId),
        orderBy("timestamp", "desc"),
      ];

      if (options?.limit) {
        constraints.push(limit(options.limit));
      }

      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const timestamp =
          data.timestamp ||
          (data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt?.toISOString?.() || new Date().toISOString());

        return {
          id: docSnap.id,
          ...data,
          timestamp,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
        } as AuditLog;
      });
    },

    async getByAction(
      orgId: string,
      action: string,
      options?: {
        limit?: number;
        offset?: number;
      },
    ): Promise<AuditLog[]> {
      const collectionRef = collection(
        firebase.firestore,
        "organizations",
        orgId,
        "auditLogs"
      );

      const constraints: any[] = [where("action", "==", action), orderBy("timestamp", "desc")];

      if (options?.limit) {
        constraints.push(limit(options.limit));
      }

      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const timestamp =
          data.timestamp ||
          (data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt?.toISOString?.() || new Date().toISOString());

        return {
          id: docSnap.id,
          ...data,
          timestamp,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
        } as AuditLog;
      });
    },
  };
}


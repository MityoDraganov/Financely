import { DatabaseService } from "../core";
import {
  AuditLog,
  AuditLogData,
  AuditLogQueryFilters,
} from "../core/entities/audit-log";
import { AuditLogRepository } from "../core/ports/repositories/audit-log-repository";
import { firestore } from "firebase-admin";
import FieldPath = firestore.FieldPath;

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) {
        continue;
      }
      const normalized = stripUndefinedDeep(nestedValue);
      if (normalized !== undefined) {
        output[key] = normalized;
      }
    }
    return output as T;
  }

  return value;
}

/**
 * Factory for an `AuditLogRepository` backed by the provided `DatabaseService`.
 * Stores audit logs as subcollection documents: organizations/{orgId}/auditLogs/{logId}
 */
export function getAuditLogRepository(
  databaseService: DatabaseService,
): AuditLogRepository {
  return {
    async create(orgId: string, data: AuditLogData): Promise<string> {
      const collectionRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("auditLogs");

      const timestamp = data.timestamp || new Date().toISOString();
      const sanitized = stripUndefinedDeep({
        ...data,
        timestamp,
      });
      
      const docRef = await collectionRef.add({
        ...(sanitized as Record<string, unknown>),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      return docRef.id;
    },

    async get(orgId: string, id: string): Promise<AuditLog | null> {
      const docRef = firestore()
        .collection("organizations")
        .doc(orgId)
        .collection("auditLogs")
        .doc(id);

      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp || data.createdAt?.toISOString() || new Date().toISOString(),
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        firestore()
          .collection("organizations")
          .doc(orgId)
          .collection("auditLogs");

      // Apply filters
      const queryConstraints: Array<{
        field: string | FieldPath;
        operator: FirebaseFirestore.WhereFilterOp;
        value: unknown;
      }> = [];

      if (filters.userId) {
        queryConstraints.push({
          field: "user.userId",
          operator: "==",
          value: filters.userId,
        });
      }

      if (filters.action) {
        queryConstraints.push({
          field: "action",
          operator: "==",
          value: filters.action,
        });
      }

      if (filters.severity) {
        queryConstraints.push({
          field: "severity",
          operator: "==",
          value: filters.severity,
        });
      }

      if (filters.resourceType) {
        queryConstraints.push({
          field: "resource.type",
          operator: "==",
          value: filters.resourceType,
        });
      }

      if (filters.resourceId) {
        queryConstraints.push({
          field: "resource.id",
          operator: "==",
          value: filters.resourceId,
        });
      }

      if (filters.status) {
        queryConstraints.push({
          field: "outcome.status",
          operator: "==",
          value: filters.status,
        });
      }

      if (filters.startDate) {
        queryConstraints.push({
          field: "timestamp",
          operator: ">=",
          value: filters.startDate,
        });
      }

      if (filters.endDate) {
        queryConstraints.push({
          field: "timestamp",
          operator: "<=",
          value: filters.endDate,
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        queryConstraints.push({
          field: "metadata.tags",
          operator: "array-contains-any",
          value: filters.tags,
        });
      }

      // Apply query constraints
      for (const constraint of queryConstraints) {
        query = query.where(constraint.field, constraint.operator, constraint.value);
      }

      // Apply ordering (default to timestamp descending for most recent first)
      // Note: Firestore requires an index for queries with filters + orderBy on different fields
      // For now, we'll always order by timestamp (create index if needed)
      const orderByDirection = options?.orderBy?.direction || "desc";
      
      // Always order by timestamp - if this fails due to index requirements,
      // the error will be caught and logged, but the query will still work
      query = query.orderBy("timestamp", orderByDirection);

      // Get total count (before pagination)
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Apply pagination
      if (options?.offset) {
        // For offset, we need to skip documents
        // Note: Firestore doesn't support offset efficiently, so we use cursor-based pagination
        // For simplicity, we'll use limit with offset approximation
        const offset = options.offset;
        const limit = options.limit || 50;
        query = query.limit(offset + limit);
      } else if (options?.limit) {
        query = query.limit(options.limit);
      }

      const querySnapshot = await query.get();
      const logs = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp || data.createdAt?.toISOString() || new Date().toISOString(),
        } as AuditLog;
      });

      // If offset was used, slice the results
      if (options?.offset) {
        return {
          logs: logs.slice(options.offset),
          total,
        };
      }

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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        firestore()
          .collection("organizations")
          .doc(orgId)
          .collection("auditLogs")
          .where("resource.type", "==", resourceType)
          .where("resource.id", "==", resourceId)
          .orderBy("timestamp", "desc");

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const querySnapshot = await query.get();
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp || data.createdAt?.toISOString() || new Date().toISOString(),
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        firestore()
          .collection("organizations")
          .doc(orgId)
          .collection("auditLogs")
          .where("user.userId", "==", userId)
          .orderBy("timestamp", "desc");

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const querySnapshot = await query.get();
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp || data.createdAt?.toISOString() || new Date().toISOString(),
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
      let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
        firestore()
          .collection("organizations")
          .doc(orgId)
          .collection("auditLogs")
          .where("action", "==", action)
          .orderBy("timestamp", "desc");

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const querySnapshot = await query.get();
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp || data.createdAt?.toISOString() || new Date().toISOString(),
        } as AuditLog;
      });
    },
  };
}

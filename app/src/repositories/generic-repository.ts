import { DatabaseService } from "@/core";
import {
  EmptyPayloadExtender,
  GenericRepository,
} from "../core/ports/repositories/generic-repository";

export const getGenericRepository = <
  TEntity,
  TEntityData,
  TPayloadExtender = EmptyPayloadExtender,
>(
  getDatabaseCollection: (p: TPayloadExtender) => string,
  databaseService: DatabaseService,
): GenericRepository<TEntity, TEntityData, TPayloadExtender> => {
  return {
    async get(payload) {
      return databaseService.get<TEntity>(
        getDatabaseCollection(payload),
        payload.id,
      );
    },

    async getAll(payload) {
      return databaseService.getPaginated<TEntity>(
        getDatabaseCollection(payload),
        payload.queryConstraints || [],
        payload.pagination || {},
        payload.orderBy,
      );
    },

    async getAllGroup(payload) {
      return databaseService.getPaginated<TEntity>(
        getDatabaseCollection(payload),
        payload.queryConstraints || [],
        payload.pagination || {},
        payload.orderBy,
      );
    },

    async getAllGroupByID(payload) {
      return databaseService.getPaginated<TEntity>(
        getDatabaseCollection(payload),
        [{ field: "id", operator: "==", value: payload.id }],
        {},
      );
    },

    async create(payload) {
      return databaseService.create<TEntityData>(
        getDatabaseCollection(payload),
        payload.data,
      );
    },

    async set(payload) {
      return databaseService.set<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.data,
      );
    },

    async update(payload) {
      return databaseService.update<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.data,
      );
    },

    async delete(payload) {
      return databaseService.delete(getDatabaseCollection(payload), payload.id);
    },

    async increment(payload) {
      // Since the database service doesn't have increment method,
      // we'll implement it using update with field increments
      const updates: Record<string, number> = {};
      payload.fields.forEach((field) => {
        updates[field.name as string] = field.value;
      });

      return databaseService.update(
        getDatabaseCollection(payload),
        payload.id,
        updates,
      );
    },

    async addToSet(payload) {
      return databaseService.addToSet(
        getDatabaseCollection(payload),
        payload.id,
        payload.fieldName as string,
        payload.value,
      );
    },

    async removeFromSet(payload) {
      return databaseService.removeFromSet(
        getDatabaseCollection(payload),
        payload.id,
        payload.fieldName as string,
        payload.value,
      );
    },
  };
};

import { firestore } from "firebase-admin";

export interface QueryConstraint {
  field: string | firestore.FieldPath;
  operator:
    | "<"
    | "<="
    | "=="
    | "!="
    | ">="
    | ">"
    | "array-contains"
    | "in"
    | "array-contains-any"
    | "not-in";
  value: unknown;
}

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface OrderByOptions {
  field: string;
  direction: "asc" | "desc";
}

export type BatchOperation = (batch: firestore.WriteBatch) => void;

export interface FieldNameAndValue {
  name: string;
  value: number;
}

export interface DatabaseService {
  get<T>(collectionName: string, id: string): Promise<T | null>;

  getAll<T>(
    collectionName: string,
    paginationOptions?: PaginationOptions,
    orderByOptions?: OrderByOptions,
  ): Promise<T[]>;

  getAllByFields<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[],
    paginationOptions: PaginationOptions,
    orderByOptions?: OrderByOptions,
  ): Promise<T[]>;

  getAllGroup<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[],
    paginationOptions: PaginationOptions,
    orderByOptions?: OrderByOptions,
  ): Promise<T[]>;

  create<T>(collectionName: string, data: T): Promise<string>;

  set<T>(collectionName: string, id: string, data: T): Promise<void>;

  batchSet<T>(collectionName: string, id: string, data: T): BatchOperation;

  update<T>(
    collectionName: string,
    id: string,
    data: Partial<T>,
  ): Promise<void>;

  increment(
    collectionName: string,
    id: string,
    field: string,
    value: number,
  ): Promise<void>;

  incrementMany(
    collectionName: string,
    id: string,
    fields: FieldNameAndValue[],
  ): Promise<void>;

  decrement(
    collectionName: string,
    id: string,
    field: string,
    value: number,
  ): Promise<void>;

  delete(collectionName: string, id: string): Promise<void>;

  executeBatchOperations(
    operations: BatchOperation[],
    batchSize?: number,
  ): Promise<void>;

  addToSet<T>(
    collectionName: string,
    id: string,
    fieldName: keyof T,
    value: T[keyof T],
  ): Promise<void>;

  removeFromSet<T>(
    collectionName: string,
    id: string,
    fieldName: keyof T,
    value: T[keyof T],
  ): Promise<void>;
}

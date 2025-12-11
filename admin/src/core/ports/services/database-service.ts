import { CallbackFn, UnsubscribeFn } from "../repositories/utilities";

export interface QueryConstraint {
  field: string;
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

export interface DatabaseService {
  get<T>(collectionName: string, id: string): Promise<T | null>;
  getByField<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[],
  ): Promise<T | null>;
  getPaginated<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[],
    paginationOptions: PaginationOptions,
    orderByOptions?: OrderByOptions,
  ): Promise<T[]>;
  subscribe<T>(
    collectionName: string,
    id: string,
    callback: CallbackFn<T>,
  ): UnsubscribeFn;
  create<T>(collectionName: string, data: T): Promise<string>;
  set<T>(collectionName: string, id: string, data: T): Promise<void>;
  update<T>(
    collectionName: string,
    id: string,
    data: Partial<T>,
  ): Promise<void>;
  addToSet<T>(
    collectionName: string,
    id: string,
    field: string,
    value: T,
  ): Promise<void>;
  removeFromSet<T>(
    collectionName: string,
    id: string,
    field: string,
    value: T,
  ): Promise<void>;
  delete(collectionName: string, id: string): Promise<void>;
}

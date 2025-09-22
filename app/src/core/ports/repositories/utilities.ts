import type {
  OrderByOptions,
  PaginationOptions,
  QueryConstraint,
} from "@/core";

export interface GetOptions {
  queryConstraints?: QueryConstraint[];
  pagination?: PaginationOptions;
  orderBy?: OrderByOptions;
}

export type UnsubscribeFn = () => void;
export type CallbackFn<T> = (data: T | null) => void;

export type GetPayload = {
  id: string;
};

export type IDOnlyPayload = {
  id: string;
};

export type CreatePayload<T> = {
  data: T;
};

export type SetPayload<T> = {
  id: string;
  data: T;
};

export type BatchSetPayload<T> = {
  id: string;
  data: T;
};

export type UpdatePayload<T> = {
  id: string;
  data: Partial<T>;
};

export type IncrementFieldsPayload<T> = {
  id: string;
  fields: {
    name: keyof T;
    value: number;
  }[];
};

export type AddToSetPayload<T> = {
  id: string;
  fieldName: keyof T;
  value: T[keyof T];
};

export type RemoveFromSetPayload<T> = {
  id: string;
  fieldName: keyof T;
  value: T[keyof T];
};

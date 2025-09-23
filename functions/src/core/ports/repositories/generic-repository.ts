import { BatchOperation } from "../services/database-service";
import {
  AddToSetPayload,
  BatchSetPayload,
  CreatePayload,
  GetOptions,
  IDOnlyPayload,
  IncrementFieldsPayload,
  RemoveFromSetPayload,
  SetPayload,
  UpdatePayload,
} from "./utilities";

export type EmptyPayloadExtender = unknown;

export interface GenericRepository<
  TEntity,
  TEntityData,
  TPayloadExtender = EmptyPayloadExtender,
> {
  get: (payload: IDOnlyPayload & TPayloadExtender) => Promise<TEntity | null>;
  getAll: (payload: GetOptions & TPayloadExtender) => Promise<TEntity[]>;
  getAllGroup(payload: GetOptions & TPayloadExtender): Promise<TEntity[]>;
  getAllGroupByID: (
    payload: IDOnlyPayload & TPayloadExtender,
  ) => Promise<TEntity[]>;
  create: (
    payload: CreatePayload<TEntityData> & TPayloadExtender,
  ) => Promise<string>;
  set: (payload: SetPayload<TEntityData> & TPayloadExtender) => Promise<void>;
  batchSet: (
    payload: BatchSetPayload<TEntityData> & TPayloadExtender,
  ) => BatchOperation;
  update: (
    payload: UpdatePayload<TEntityData> & TPayloadExtender,
  ) => Promise<void>;
  delete: (payload: IDOnlyPayload & TPayloadExtender) => Promise<void>;
  increment(
    payload: IncrementFieldsPayload<TEntity> & TPayloadExtender,
  ): Promise<void>;
  addToSet: (
    payload: AddToSetPayload<TEntityData> & TPayloadExtender,
  ) => Promise<void>;
  removeFromSet: (
    payload: RemoveFromSetPayload<TEntityData> & TPayloadExtender,
  ) => Promise<void>;
}

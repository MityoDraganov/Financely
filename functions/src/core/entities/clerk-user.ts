import type { UserJSON, DeletedObjectJSON } from "@clerk/backend";
export type ClerkUser = UserJSON;
export type ClerkDeletedObject = DeletedObjectJSON;
export enum ClerkEventType {
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
}


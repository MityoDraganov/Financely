import { DatabaseService } from "../core";
import { User, UserData } from "../core/entities/user";
import { UserRepository } from "../core/ports/repositories/user-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `UserRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {UserRepository} Repository with CRUD operations for users.
 */
export function getUserRepository(
  databaseService: DatabaseService,
): UserRepository {
  return getGenericRepository<User, UserData>(
    () => DatabaseCollection.USERS,
    databaseService,
  );
}


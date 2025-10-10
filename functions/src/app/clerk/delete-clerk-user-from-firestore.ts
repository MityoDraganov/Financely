import { ClerkDeletedObject, LoggerService, UserRepository } from "../../core";

interface Payload {
  clerkUser: ClerkDeletedObject;
}

interface Dependencies {
  loggerService: LoggerService;
  userRepository: UserRepository;
}

/**
 * Delete user from Firestore when Clerk user is deleted
 *
 * @param {Payload} payload - Contains the deleted Clerk user data
 * @param {Dependencies} dependencies - Required services
 * @return {Promise<void>}
 */
export async function deleteClerkUserFromFirestore(
  payload: Payload,
  dependencies: Dependencies,
): Promise<void> {
  const { clerkUser } = payload;
  const { loggerService, userRepository } = dependencies;

  loggerService.info("Deleting Clerk user from Firestore:", clerkUser.id);

  if (!clerkUser.id) {
    loggerService.error("Clerk user ID is required");
    throw new Error("Clerk user ID is required");
  }

  try {
    // Delete user from Firestore
    await userRepository.delete({
      id: clerkUser.id,
    });

    loggerService.info("User deleted from Firestore successfully:", clerkUser.id);
  } catch (error) {
    loggerService.warn("Error deleting user from Firestore:", error);
    // Don't throw error for deletion failures - log and continue
  }
}


import { ClerkUser, LoggerService, UserRepository } from "../../core";
import { getAuth } from "firebase-admin/auth";
import { isValidAdminRole } from "../../core/admin/admin-roles";

interface Payload {
  clerkUser: ClerkUser;
}

interface Dependencies {
  loggerService: LoggerService;
  userRepository: UserRepository;
}

/**
 * Create user in Firestore when Clerk user is created
 *
 * @param {Payload} payload - Contains the Clerk user data
 * @param {Dependencies} dependencies - Required services
 * @return {Promise<void>}
 */
export async function createClerkUserInFirestore(
  payload: Payload,
  dependencies: Dependencies,
): Promise<void> {
  const { clerkUser } = payload;
  const { loggerService, userRepository } = dependencies;

  loggerService.info("Creating Clerk user in Firestore:", clerkUser.id);

  // Validate email address
  if (clerkUser.email_addresses.length === 0) {
    throw new Error("Clerk user doesn't have an email address");
  }

  const primaryEmail = clerkUser.email_addresses[0].email_address;
  loggerService.info(`Clerk user email: ${primaryEmail}`);

  // Build display name
  let displayName = "";
  if (clerkUser.first_name && clerkUser.last_name) {
    displayName = `${clerkUser.first_name} ${clerkUser.last_name}`;
  } else if (clerkUser.first_name) {
    displayName = clerkUser.first_name;
  } else if (clerkUser.last_name) {
    displayName = clerkUser.last_name;
  }

  try {
    // Create user in Firestore with Clerk ID as document ID
    const userData = {
      clerkId: clerkUser.id,
      email: primaryEmail,
      name: displayName || primaryEmail.split("@")[0],
      organizationRoles: {},
      status: "active" as const,
      preferences: {
        theme: "system" as const,
        language: "en",
        timezone: "UTC",
      },
      // Only include avatarUrl if it exists and is not empty
      ...(clerkUser.image_url && { avatarUrl: clerkUser.image_url }),
    };

    await userRepository.set({
      id: clerkUser.id,
      data: userData,
    });

    // Sync admin role from Clerk publicMetadata to Firebase Auth custom claims
    const adminRole = clerkUser.public_metadata?.adminRole;
    if (adminRole && typeof adminRole === 'string' && isValidAdminRole(adminRole)) {
      try {
        const auth = getAuth();
        await auth.setCustomUserClaims(clerkUser.id, {
          adminRole: adminRole,
        });
        loggerService.info("Admin role synced to Firebase Auth custom claims:", {
          userId: clerkUser.id,
          adminRole,
        });
      } catch (error) {
        loggerService.error("Failed to set admin role in Firebase Auth custom claims:", error);
        // Don't throw - user creation succeeded, just custom claims failed
      }
    }

    loggerService.info("User created in Firestore successfully:", clerkUser.id);
  } catch (error) {
    loggerService.error("Failed to create user in Firestore:", error);
    throw new Error(
      `Failed to create user in Firestore: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}


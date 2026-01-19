import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAuth } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { loggerService } from "../services/logger-service";

interface RegisterContributorInput {
  termsAccepted: boolean;
}

interface RegisterContributorResponse {
  success: boolean;
  message: string;
}

interface GetContributorStatusResponse {
  isContributor: boolean;
  submissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt?: string;
    publishedAt?: string;
  }>;
}

/**
 * Register as a marketplace contributor
 * Requires authentication and terms acceptance
 */
export const registerAsContributor = onCall<
  RegisterContributorInput,
  Promise<RegisterContributorResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      const userId = await verifyAuth(request);

      const { termsAccepted } = request.data;

      if (!termsAccepted) {
        throw new HttpsError(
          "failed-precondition",
          "You must accept the contributor terms"
        );
      }

      const db = getFirestore();
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      // Update user document to mark as contributor
      await db.collection("users").doc(userId).update({
        isMarketplaceContributor: true,
        contributorTermsAcceptedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      loggerService.info("User registered as marketplace contributor", {
        userId,
      });

      return {
        success: true,
        message:
          "You are now registered as a contributor. You can submit templates to the marketplace.",
      };
    } catch (error) {
      loggerService.error("Error registering contributor", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to register as contributor"
      );
    }
  }
);

/**
 * Get contributor status and submissions
 * Requires authentication
 */
export const getContributorStatus = onCall<
  {},
  Promise<GetContributorStatusResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      const userId = await verifyAuth(request);

      const db = getFirestore();
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const isContributor = userData?.isMarketplaceContributor === true;

      if (!isContributor) {
        return {
          isContributor: false,
          submissions: [],
        };
      }

      // Get user's submissions
      const databaseService = getDatabaseService();
      const templateRepo = getMarketplaceTemplateRepository(databaseService);

      const submissions = await templateRepo.getAll({
        queryConstraints: [
          { field: "authorId", operator: "==", value: userId },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });

      return {
        isContributor: true,
        submissions: submissions.map((template) => ({
          id: template.id,
          title: template.title,
          status: template.status,
          createdAt: template.createdAt,
          publishedAt: template.publishedAt,
        })),
      };
    } catch (error) {
      loggerService.error("Error getting contributor status", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to get contributor status"
      );
    }
  }
);

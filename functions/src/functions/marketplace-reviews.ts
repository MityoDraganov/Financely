import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAuth } from "../utils/auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceReviewRepository } from "../repositories/marketplace-review-repository";
import { marketplaceTemplateService } from "../services/marketplace-template-service";
import { loggerService } from "../services/logger-service";

interface SubmitReviewInput {
  templateId: string;
  rating: number;
  comment?: string;
}

interface SubmitReviewResponse {
  reviewId: string;
  message: string;
}

interface GetReviewsInput {
  templateId: string;
  page?: number;
  limit?: number;
}

interface GetReviewsResponse {
  reviews: Array<{
    id: string;
    userId: string;
    userName: string;
    rating: number;
    comment?: string;
    createdAt?: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * Submit a review for a marketplace template
 * Requires authentication
 */
export const submitMarketplaceReview = onCall<
  SubmitReviewInput,
  Promise<SubmitReviewResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      const userId = await verifyAuth(request);

      const { templateId, rating, comment } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      if (!rating || rating < 1 || rating > 5) {
        throw new HttpsError(
          "invalid-argument",
          "Rating must be between 1 and 5"
        );
      }

      const databaseService = getDatabaseService();
      const reviewRepo = getMarketplaceReviewRepository(databaseService);
      const db = getFirestore();

      // Get user info
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      const userName = userData?.name || userData?.email || "Anonymous";

      // Check if user already reviewed this template
      const existingReviews = await reviewRepo.getAll({
        queryConstraints: [
          { field: "templateId", operator: "==", value: templateId },
          { field: "userId", operator: "==", value: userId },
        ],
      });

      if (existingReviews.length > 0) {
        // Update existing review
        const existingReview = existingReviews[0];
        await reviewRepo.update({
          id: existingReview.id,
          data: {
            rating,
            comment,
            status: "pending", // Re-moderate if updated
          },
        });

        // Update template rating
        await marketplaceTemplateService.updateTemplateRating(
          templateId,
          databaseService
        );

        return {
          reviewId: existingReview.id,
          message: "Review updated successfully",
        };
      }

      // Create new review
      const reviewId = await reviewRepo.create({
        data: {
          templateId,
          userId,
          userName,
          rating,
          comment,
          status: "pending", // Reviews need moderation
        },
      });

      // Update template rating
      await marketplaceTemplateService.updateTemplateRating(
        templateId,
        databaseService
      );

      loggerService.info("Marketplace review submitted", {
        reviewId,
        templateId,
        userId,
        rating,
      });

      return {
        reviewId,
        message: "Review submitted successfully. It will be reviewed before being published.",
      };
    } catch (error) {
      loggerService.error("Error submitting marketplace review", {
        templateId: request.data?.templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to submit review"
      );
    }
  }
);

/**
 * Get reviews for a marketplace template
 * Requires authentication
 */
export const getMarketplaceReviews = onCall<
  GetReviewsInput,
  Promise<GetReviewsResponse>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      // Verify authentication
      await verifyAuth(request);

      const { templateId, page = 1, limit = 20 } = request.data;

      if (!templateId) {
        throw new HttpsError(
          "invalid-argument",
          "Template ID is required"
        );
      }

      const databaseService = getDatabaseService();
      const reviewRepo = getMarketplaceReviewRepository(databaseService);

      // Get approved reviews only
      const result = await reviewRepo.getAll({
        queryConstraints: [
          { field: "templateId", operator: "==", value: templateId },
          { field: "status", operator: "==", value: "approved" },
        ],
        pagination: {
          limit,
        },
        orderBy: { field: "createdAt", direction: "desc" },
      });

      return {
        reviews: result.map((review) => ({
          id: review.id,
          userId: review.userId,
          userName: review.userName || "Anonymous",
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        })),
        total: result.length,
        page,
        limit,
      };
    } catch (error) {
      loggerService.error("Error getting marketplace reviews", {
        templateId: request.data?.templateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Failed to get reviews"
      );
    }
  }
);

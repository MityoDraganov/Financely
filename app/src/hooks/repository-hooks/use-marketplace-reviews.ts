import { MarketplaceReviewData } from "@/core";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";

const databaseService = serviceHost.getDatabaseService();
const marketplaceReviewRepository = repositoryHost.getMarketplaceReviewsRepository(databaseService);

/**
 * Hook to fetch approved reviews for a template
 */
export const useMarketplaceReviews = (templateId: string | undefined) => {
  return useQuery({
    queryKey: ["marketplaceReviews", templateId],
    queryFn: async () => {
      if (!templateId) return [];
      return marketplaceReviewRepository.getAll({
        queryConstraints: [
          { field: "templateId", operator: "==", value: templateId },
          { field: "status", operator: "==", value: "approved" },
        ],
        orderBy: { field: "createdAt", direction: "desc" },
      });
    },
    enabled: !!templateId,
  });
};

/**
 * Hook to submit or update a review
 */
export const useSubmitMarketplaceReview = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: async ({
      templateId,
      rating,
      comment,
    }: {
      templateId: string;
      rating: number;
      comment?: string;
    }) => {
      if (!user) {
        throw new Error("User must be authenticated to submit a review");
      }

      // Check if user already reviewed this template
      const existingReviews = await marketplaceReviewRepository.getAll({
        queryConstraints: [
          { field: "templateId", operator: "==", value: templateId },
          { field: "userId", operator: "==", value: user.id },
        ],
      });

      if (existingReviews.length > 0) {
        // Update existing review
        const existingReview = existingReviews[0];
        await marketplaceReviewRepository.update({
          id: existingReview.id,
          data: {
            rating,
            comment,
            status: "pending", // Re-moderate if updated
          },
        });
        return existingReview.id;
      } else {
        // Create new review
        const reviewData: MarketplaceReviewData = {
          templateId,
          userId: user.id,
          userName: user.fullName || user.primaryEmailAddress?.emailAddress || "Anonymous",
          rating,
          comment,
          status: "pending", // Reviews need moderation
        };
        const reviewId = await marketplaceReviewRepository.create({ data: reviewData });
        return reviewId;
      }
    },
    onSuccess: (_, { templateId }) => {
      // Invalidate template reviews
      queryClient.invalidateQueries({ queryKey: ["marketplaceReviews", templateId] });
      // Invalidate the template itself to update rating count
      queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", templateId] });
    },
  });
};

/**
 * Hook to check if current user has reviewed a template
 */
export const useUserReview = (templateId: string | undefined) => {
  const { user } = useUser();

  return useQuery({
    queryKey: ["marketplaceReviews", "user", templateId, user?.id],
    queryFn: async () => {
      if (!templateId || !user) return null;
      
      const reviews = await marketplaceReviewRepository.getAll({
        queryConstraints: [
          { field: "templateId", operator: "==", value: templateId },
          { field: "userId", operator: "==", value: user.id },
        ],
      });

      return reviews.length > 0 ? reviews[0] : null;
    },
    enabled: !!templateId && !!user,
  });
};

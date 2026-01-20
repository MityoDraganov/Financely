import { useMarketplaceReviews } from "@/hooks/repository-hooks/use-marketplace-reviews";
import { Star, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewForm } from "./review-form";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ReviewSectionProps {
  templateId: string;
}

export function ReviewSection({ templateId }: ReviewSectionProps) {
  const { data: reviews, isLoading } = useMarketplaceReviews(templateId);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground">Reviews</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {reviews?.length || 0} {reviews?.length === 1 ? "review" : "reviews"}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowReviewForm(true)}
          >
            Add Review
          </Button>
        </div>

        {showReviewForm && (
          <div className="pb-6 border-b">
            <ReviewForm
              templateId={templateId}
              onSuccess={() => setShowReviewForm(false)}
              onCancel={() => setShowReviewForm(false)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              No reviews yet. Be the first to review!
            </p>
            {!showReviewForm && (
              <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>
                Add Review
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} className="border shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted">
                          {getInitials(review.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm text-foreground">
                          {review.userName || "Anonymous"}
                        </div>
                        {review.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "h-4 w-4 transition-colors",
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

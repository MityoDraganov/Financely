import z from "zod";

export const companySizeSchema = z.enum(["solo", "small", "medium", "large"]);
export type CompanySize = z.infer<typeof companySizeSchema>;

export const useCaseSchema = z.enum(["invoicing", "proposals", "workflows", "all"]);
export type UseCase = z.infer<typeof useCaseSchema>;

export const invoiceVolumeSchema = z.enum(["0-10", "11-50", "51-200", "200+"]);
export type InvoiceVolume = z.infer<typeof invoiceVolumeSchema>;

export const budgetRangeSchema = z.enum(["free", "starter", "pro", "enterprise"]);
export type BudgetRange = z.infer<typeof budgetRangeSchema>;

export const recommendedPlanSchema = z.enum(["starter", "professional", "enterprise"]);
export type RecommendedPlan = z.infer<typeof recommendedPlanSchema>;

export const quizResultDataSchema = z.object({
  companySize: companySizeSchema,
  useCase: useCaseSchema,
  invoiceVolume: invoiceVolumeSchema,
  budgetRange: budgetRangeSchema,
  teamCollaboration: z.boolean(),
  recommendedPlan: recommendedPlanSchema,
  createdAt: z.string(),
});

export const quizResultSchema = z.object({
  id: z.string(),
  data: quizResultDataSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type QuizResultData = z.infer<typeof quizResultDataSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;

/**
 * Plan recommendation logic based on quiz answers
 */
export function recommendPlan(answers: {
  companySize: CompanySize;
  useCase: UseCase;
  invoiceVolume: InvoiceVolume;
  budgetRange: BudgetRange;
  teamCollaboration: boolean;
}): RecommendedPlan {
  const { companySize, invoiceVolume, teamCollaboration, budgetRange } = answers;

  // If user specified a budget preference, respect it (if it's not free)
  if (budgetRange !== "free") {
    return budgetRange as RecommendedPlan;
  }

  // Solo users with low volume → Starter
  if (companySize === "solo" && invoiceVolume === "0-10") {
    return "starter";
  }

  // Small teams with medium volume → Pro
  if (
    (companySize === "small" || companySize === "medium") &&
    (invoiceVolume === "11-50" || invoiceVolume === "51-200")
  ) {
    return "professional";
  }

  // Large teams or high volume → Enterprise
  if (companySize === "large" || invoiceVolume === "200+" || teamCollaboration) {
    return "enterprise";
  }

  // Default fallback → Pro (most popular)
  return "professional";
}

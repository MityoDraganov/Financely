import z from "zod";
import { baseEntitySchema } from "./base";
import { quizResultDataSchema } from "./quiz-result";

export const onboardingStepDataSchema = z.object({
  completed: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string(),
});

export const onboardingProgressDataSchema = z.object({
  // User identification
  userId: z.string().optional(), // Clerk user ID (if signed in)
  email: z.string().email().optional(), // Email for anonymous users
  
  // Progress tracking
  currentStep: z.number().int().min(0),
  stepData: z.record(z.string(), onboardingStepDataSchema).default({}),
  
  // Context data
  quizResults: quizResultDataSchema.optional(),
  selectedPlan: z.string().optional(),
  formData: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
  }).optional(),
  brandingData: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
  }).optional(),
  
  // Timestamps
  lastActivityAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const onboardingProgressSchema = baseEntitySchema.extend({
  data: onboardingProgressDataSchema,
});

export type OnboardingStepData = z.infer<typeof onboardingStepDataSchema>;
export type OnboardingProgressData = z.infer<typeof onboardingProgressDataSchema>;
export type OnboardingProgress = z.infer<typeof onboardingProgressSchema>;

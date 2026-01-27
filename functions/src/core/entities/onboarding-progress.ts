import z from "zod";
import { baseEntitySchema } from "./base";

export const onboardingStepDataSchema = z.object({
  completed: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string(),
});

export const onboardingProgressDataSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  currentStep: z.number().int().min(0),
  stepData: z.record(z.string(), onboardingStepDataSchema).default({}),
  quizResults: z.record(z.string(), z.unknown()).optional(),
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

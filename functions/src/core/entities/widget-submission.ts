import z from "zod";
import { baseEntitySchema } from "./base";

export const widgetSubmissionMetadataSchema = z.object({
	ipHash: z.string().optional(),
	userAgent: z.string().optional(),
	pageUrl: z.string().optional(),
	referrer: z.string().optional(),
	utmSource: z.string().optional(),
	utmMedium: z.string().optional(),
	utmCampaign: z.string().optional(),
	timestamp: z.string().optional(),
});

export const widgetSubmissionLinkedEntitiesSchema = z.object({
	leadId: z.string().optional(),
	contactId: z.string().optional(),
});

export const widgetSubmissionDataSchema = z.object({
	orgId: z.string(),
	widgetId: z.string(),
	widgetVersionId: z.string(),
	payload: z.record(z.string(), z.unknown()),
	metadata: widgetSubmissionMetadataSchema.optional(),
	linkedEntities: widgetSubmissionLinkedEntitiesSchema.optional(),
});

export const widgetSubmissionSchema = baseEntitySchema.merge(
	widgetSubmissionDataSchema
);

export type WidgetSubmissionMetadata = z.infer<
	typeof widgetSubmissionMetadataSchema
>;
export type WidgetSubmissionLinkedEntities = z.infer<
	typeof widgetSubmissionLinkedEntitiesSchema
>;
export type WidgetSubmissionData = z.infer<typeof widgetSubmissionDataSchema>;
export type WidgetSubmission = z.infer<typeof widgetSubmissionSchema>;

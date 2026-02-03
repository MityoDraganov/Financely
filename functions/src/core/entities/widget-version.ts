import z from "zod";
import { baseEntitySchema } from "./base";
import {
	widgetPagesSchema,
	widgetVersionActionsSchema,
} from "./widget-block-schema";

export const multiStepOptionsSchema = z.object({
	showProgressBar: z.boolean().optional(),
	progressBarPosition: z.enum(["top", "bottom"]).optional(),
	progressStyle: z.enum(["steps", "percentage"]).optional(),
	nextLabel: z.string().optional(),
	backLabel: z.string().optional(),
	submitLabel: z.string().optional(),
});

export const widgetVersionDataSchema = z.object({
	widgetId: z.string(),
	versionNumber: z.number().int(),
	pages: widgetPagesSchema,
	actions: widgetVersionActionsSchema,
	multiStepOptions: multiStepOptionsSchema.optional(),
	createdBy: z.string().nullable().optional(),
});

export const widgetVersionSchema = baseEntitySchema.merge(
	widgetVersionDataSchema
);

export type WidgetVersionData = z.infer<typeof widgetVersionDataSchema>;
export type WidgetVersion = z.infer<typeof widgetVersionSchema>;

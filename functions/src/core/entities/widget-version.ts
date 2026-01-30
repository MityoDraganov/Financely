import z from "zod";
import { baseEntitySchema } from "./base";
import {
	widgetBlockTreeSchema,
	widgetVersionActionsSchema,
} from "./widget-block-schema";

export const widgetVersionDataSchema = z.object({
	widgetId: z.string(),
	versionNumber: z.number().int(),
	schema: widgetBlockTreeSchema,
	actions: widgetVersionActionsSchema,
	createdBy: z.string().nullable().optional(),
});

export const widgetVersionSchema = baseEntitySchema.merge(
	widgetVersionDataSchema
);

export type WidgetVersionData = z.infer<typeof widgetVersionDataSchema>;
export type WidgetVersion = z.infer<typeof widgetVersionSchema>;

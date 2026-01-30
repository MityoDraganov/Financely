import z from "zod";
import { baseEntitySchema } from "./base";

export const widgetDefinitionStatusSchema = z.enum(["draft", "published"]);

export const widgetDefinitionDataSchema = z.object({
	orgId: z.string(),
	name: z.string(),
	status: widgetDefinitionStatusSchema,
	publishedVersionId: z.string().nullable(),
	themeRef: z.string().nullable().optional(),
});

export const widgetDefinitionSchema = baseEntitySchema.merge(
	widgetDefinitionDataSchema
);

export type WidgetDefinitionStatus = z.infer<typeof widgetDefinitionStatusSchema>;
export type WidgetDefinitionData = z.infer<typeof widgetDefinitionDataSchema>;
export type WidgetDefinition = z.infer<typeof widgetDefinitionSchema>;

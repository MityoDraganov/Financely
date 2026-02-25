import z from "zod";
import { baseEntitySchema } from "./base";

export const widgetDefinitionStatusSchema = z.enum(["draft", "published"]);

export const widgetPageConfigSchema = z.object({
	headline: z.string().optional(),
	body: z.string().optional(),
	primaryColor: z.string().optional(),
	trustSignals: z.array(z.object({
		icon: z.enum(["shield", "clock", "star", "check", "lock"]),
		label: z.string(),
	})).optional(),
	hideBrandPanel: z.boolean().optional(),
	formTitle: z.string().optional(),
	formSubtitle: z.string().optional(),
	footerLinks: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
	showPoweredBy: z.boolean().optional(),
});

export const widgetDefinitionDataSchema = z.object({
	orgId: z.string(),
	name: z.string(),
	status: widgetDefinitionStatusSchema,
	publishedVersionId: z.string().nullable(),
	themeRef: z.string().nullable().optional(),
	pageConfig: widgetPageConfigSchema.nullable().optional(),
});

export const widgetDefinitionSchema = baseEntitySchema.merge(
	widgetDefinitionDataSchema
);

export type WidgetDefinitionStatus = z.infer<typeof widgetDefinitionStatusSchema>;
export type WidgetDefinitionData = z.infer<typeof widgetDefinitionDataSchema>;
export type WidgetDefinition = z.infer<typeof widgetDefinitionSchema>;

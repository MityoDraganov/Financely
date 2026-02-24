import z from "zod";

/** Block types for layout, content, input, action */
export const layoutBlockTypeSchema = z.enum([
	"container",
	"card",
	"sectionHeader",
	"columns",
	"divider",
	"spacer",
]);
export const contentBlockTypeSchema = z.enum(["paragraph"]);
export const inputBlockTypeSchema = z.enum([
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"checkbox",
	"date",
	"file",
]);
export const actionBlockTypeSchema = z.enum(["submitButton", "successBlock"]);

export const blockTypeSchema = z.union([
	layoutBlockTypeSchema,
	contentBlockTypeSchema,
	inputBlockTypeSchema,
	actionBlockTypeSchema,
]);

export type BlockType = z.infer<typeof blockTypeSchema>;

const layoutBlockPropsSchema = z.object({
	columns: z.union([z.literal(1), z.literal(2)]).optional(),
});

const sectionHeaderPropsSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
});

const paragraphPropsSchema = z.object({
	content: z.string(),
});

const inputBlockPropsSchema = z.object({
	label: z.string(),
	required: z.boolean().optional(),
	placeholder: z.string().optional(),
	fieldKey: z.string(),
	helperText: z.string().optional(),
});

const selectInputPropsSchema = inputBlockPropsSchema.extend({
	options: z.array(z.string()),
});

const successBlockPropsSchema = z.object({
	message: z.string(),
	redirectUrl: z.string().optional(),
	redirectButtonText: z.string().optional(),
});

const submitButtonPropsSchema = z.object({
	label: z.string(),
});

const blockPropsSchema = z.union([
	layoutBlockPropsSchema.passthrough(),
	sectionHeaderPropsSchema.passthrough(),
	paragraphPropsSchema.passthrough(),
	inputBlockPropsSchema.passthrough(),
	selectInputPropsSchema.passthrough(),
	successBlockPropsSchema.passthrough(),
	submitButtonPropsSchema.passthrough(),
	z.record(z.string(), z.unknown()),
]);

/** Block schema; children validated one level deep to avoid Zod 4 recursive lazy issues */
const widgetBlockSchemaShallow = z.object({
	id: z.string(),
	type: blockTypeSchema,
	props: blockPropsSchema,
	children: z
		.array(
			z.object({
				id: z.string(),
				type: blockTypeSchema,
				props: blockPropsSchema,
				children: z.array(z.any()).optional(),
			})
		)
		.optional(),
});

export const widgetBlockSchema = widgetBlockSchemaShallow;

export const widgetBlockTreeSchema = z.array(widgetBlockSchema);

export type WidgetBlock = z.infer<typeof widgetBlockSchema>;
export type WidgetBlockSchema = z.infer<typeof widgetBlockTreeSchema>;

export const widgetPageSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	fields: widgetBlockTreeSchema,
});

export const widgetPagesSchema = z.array(widgetPageSchema);

export type WidgetPage = z.infer<typeof widgetPageSchema>;

export const widgetVersionActionsSchema = z.object({
	createLead: z
		.object({
			enabled: z.boolean(),
			tags: z.array(z.string()).optional(),
		})
		.optional(),
	notify: z
		.object({
			enabled: z.boolean(),
		})
		.optional(),
	success: z
		.object({
			message: z.string(),
			redirectUrl: z.string().optional(),
		})
		.optional(),
});

export type WidgetVersionActions = z.infer<typeof widgetVersionActionsSchema>;

import type {
	WidgetPageBlock,
	WidgetPageConfig,
	WidgetPageSchema,
	WidgetPageTrustSignal,
} from "@/core/entities/widget-definition";

const DEFAULT_PAGE_BODY =
	"Complete the form and our team will review your submission. We typically respond within one business day.";
const DEFAULT_FORM_TITLE = "Get in touch";
const DEFAULT_FORM_SUBTITLE = "Fill in the details below and we'll get back to you.";

const DEFAULT_TRUST_SIGNALS: WidgetPageTrustSignal[] = [
	{ icon: "shield", label: "Your data is secure" },
	{ icon: "clock", label: "Replies within 24h" },
	{ icon: "star", label: "No spam, ever" },
];

function sanitizeWidgetName(widgetName: string): string {
	const trimmed = widgetName.trim();
	return trimmed.length > 0 ? trimmed : "Widget";
}

export function hasPageConfigValues(config: WidgetPageConfig | null | undefined): boolean {
	return Boolean(config && Object.keys(config).length > 0);
}

export function buildDefaultWidgetPageConfig(
	widgetName: string,
	options?: {
		primaryColor?: string | null | undefined;
	},
): WidgetPageConfig {
	const resolvedWidgetName = sanitizeWidgetName(widgetName);
	const resolvedPrimaryColor = options?.primaryColor?.trim() || undefined;
	const trustSignals = DEFAULT_TRUST_SIGNALS.map((signal) => ({ ...signal }));

	const blocks: WidgetPageBlock[] = [
		{
			id: "default-side-panel",
			type: "sidePanel",
			position: "left",
			title: resolvedWidgetName,
			body: DEFAULT_PAGE_BODY,
			primaryColor: resolvedPrimaryColor,
			trustSignals,
		},
	];

	const schema: WidgetPageSchema = {
		version: 1,
		layout: {
			mode: "sidebar",
			sidebarPosition: "left",
			sidebarWidth: "md",
			backgroundStyle: "clean",
			sidebarPrimaryColor: resolvedPrimaryColor,
		},
		sidebar: [
			{
				id: "schema-sidebar-logo",
				type: "logo",
				showCompanyName: false,
			},
			{
				id: "schema-sidebar-heading",
				type: "heading",
				text: resolvedWidgetName,
				level: 1,
			},
			{
				id: "schema-sidebar-body",
				type: "text",
				text: DEFAULT_PAGE_BODY,
			},
			{
				id: "schema-sidebar-icons",
				type: "iconList",
				items: trustSignals.map((signal) => ({
					icon: signal.icon,
					text: signal.label,
				})),
			},
		],
		main: [
			{
				id: "schema-widget-form",
				type: "widgetForm",
				title: DEFAULT_FORM_TITLE,
				subtitle: DEFAULT_FORM_SUBTITLE,
			},
		],
	};

	return {
		layout: "split",
		headline: resolvedWidgetName,
		body: DEFAULT_PAGE_BODY,
		primaryColor: resolvedPrimaryColor,
		trustSignals,
		hideBrandPanel: false,
		formTitle: DEFAULT_FORM_TITLE,
		formSubtitle: DEFAULT_FORM_SUBTITLE,
		footerLinks: [],
		backgroundStyle: "clean",
		blocks,
		schema,
	};
}

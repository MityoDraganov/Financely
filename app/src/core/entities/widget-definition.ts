import type { BaseEntity } from "./base";

export type WidgetDefinitionStatus = "draft" | "published";

export interface WidgetPageConfig {
	/** Left panel headline shown on the public share page */
	headline?: string;
	/** Body copy shown below the headline */
	body?: string;
	/** Override the primary color on the share page */
	primaryColor?: string;
	/** Trust signals shown in the left panel */
	trustSignals?: Array<{ icon: "shield" | "clock" | "star" | "check" | "lock"; label: string }>;
	/** Hide the left branding panel entirely */
	hideBrandPanel?: boolean;
	/** Right-panel form title override */
	formTitle?: string;
	/** Right-panel form subtitle override */
	formSubtitle?: string;
	/** Footer links shown on the public page */
	footerLinks?: Array<{ label: string; url: string }>;
	/** Whether to show "Powered by Financely" */
	showPoweredBy?: boolean;
}

export interface WidgetDefinitionData {
	orgId: string;
	name: string;
	status: WidgetDefinitionStatus;
	publishedVersionId: string | null;
	themeRef?: string | null;
	pageConfig?: WidgetPageConfig | null;
}

export type WidgetDefinition = BaseEntity & WidgetDefinitionData;

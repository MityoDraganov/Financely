import type { BaseEntity } from "./base";

export type WidgetDefinitionStatus = "draft" | "published";

/** Layout variant for the public share page */
export type WidgetPageLayout = "split" | "centered" | "minimal";
export type WidgetPageTrustSignalIcon = "shield" | "clock" | "star" | "check" | "lock";
export type WidgetPageContentPosition = "top" | "bottom";
export type WidgetPageSidePanelPosition = "left" | "right";

export interface WidgetPageTrustSignal {
	icon: WidgetPageTrustSignalIcon;
	label: string;
}

export interface WidgetPageFooterLink {
	label: string;
	url: string;
}

export interface WidgetPageCopyBlock {
	id: string;
	type: "copy";
	position: WidgetPageContentPosition;
	title?: string;
	body?: string;
}

export interface WidgetPageSidePanelBlock {
	id: string;
	type: "sidePanel";
	position: WidgetPageSidePanelPosition;
	title?: string;
	body?: string;
	primaryColor?: string;
	trustSignals?: WidgetPageTrustSignal[];
}

export interface WidgetPagePolicyLinksBlock {
	id: string;
	type: "policyLinks";
	position: WidgetPageContentPosition;
	links: WidgetPageFooterLink[];
}

export type WidgetPageBlock =
	| WidgetPageCopyBlock
	| WidgetPageSidePanelBlock
	| WidgetPagePolicyLinksBlock;

export type WidgetPageSchemaSidebarWidth = "sm" | "md" | "lg";
export type WidgetPageSchemaBlockType =
	| "stack"
	| "heading"
	| "text"
	| "logo"
	| "list"
	| "iconList"
	| "policyLinks"
	| "widgetForm"
	| "spacer";

export interface WidgetPageSchemaBaseBlock {
	id: string;
	type: WidgetPageSchemaBlockType;
}

export interface WidgetPageSchemaStackBlock extends WidgetPageSchemaBaseBlock {
	type: "stack";
	gap?: "sm" | "md" | "lg";
	children: WidgetPageSchemaBlock[];
}

export interface WidgetPageSchemaHeadingBlock extends WidgetPageSchemaBaseBlock {
	type: "heading";
	text: string;
	level?: 1 | 2 | 3;
}

export interface WidgetPageSchemaTextBlock extends WidgetPageSchemaBaseBlock {
	type: "text";
	text: string;
}

export interface WidgetPageSchemaLogoBlock extends WidgetPageSchemaBaseBlock {
	type: "logo";
	showCompanyName?: boolean;
}

export interface WidgetPageSchemaListBlock extends WidgetPageSchemaBaseBlock {
	type: "list";
	items: string[];
}

export interface WidgetPageSchemaIconListBlock extends WidgetPageSchemaBaseBlock {
	type: "iconList";
	items: Array<{
		icon: WidgetPageTrustSignalIcon;
		text: string;
	}>;
}

export interface WidgetPageSchemaPolicyLinksBlock extends WidgetPageSchemaBaseBlock {
	type: "policyLinks";
	links: WidgetPageFooterLink[];
}

export interface WidgetPageSchemaWidgetFormBlock extends WidgetPageSchemaBaseBlock {
	type: "widgetForm";
	title?: string;
	subtitle?: string;
}

export interface WidgetPageSchemaSpacerBlock extends WidgetPageSchemaBaseBlock {
	type: "spacer";
	size?: "sm" | "md" | "lg";
}

export type WidgetPageSchemaBlock =
	| WidgetPageSchemaStackBlock
	| WidgetPageSchemaHeadingBlock
	| WidgetPageSchemaTextBlock
	| WidgetPageSchemaLogoBlock
	| WidgetPageSchemaListBlock
	| WidgetPageSchemaIconListBlock
	| WidgetPageSchemaPolicyLinksBlock
	| WidgetPageSchemaWidgetFormBlock
	| WidgetPageSchemaSpacerBlock;

export interface WidgetPageSchema {
	version: 1;
	layout: {
		mode: "sidebar";
		sidebarPosition: WidgetPageSidePanelPosition;
		sidebarWidth?: WidgetPageSchemaSidebarWidth;
		backgroundStyle?: "clean" | "subtle-grid" | "gradient";
		sidebarPrimaryColor?: string;
	};
	sidebar: WidgetPageSchemaBlock[];
	main: WidgetPageSchemaBlock[];
}

export interface WidgetPageConfig {
	/** Layout variant for the public share page */
	layout?: WidgetPageLayout;
	/** Left panel headline shown on the public share page */
	headline?: string;
	/** Body copy shown below the headline */
	body?: string;
	/** Override the primary color on the share page */
	primaryColor?: string;
	/** Trust signals shown in the left panel */
	trustSignals?: WidgetPageTrustSignal[];
	/** Hide the left branding panel entirely */
	hideBrandPanel?: boolean;
	/** Right-panel form title override */
	formTitle?: string;
	/** Right-panel form subtitle override */
	formSubtitle?: string;
	/** Footer links shown on the public page */
	footerLinks?: WidgetPageFooterLink[];
	/** Background style for the page */
	backgroundStyle?: "clean" | "subtle-grid" | "gradient";
	/** Block-based share page customization (used by integrations page) */
	blocks?: WidgetPageBlock[];
	/** Drag-and-drop page builder schema */
	schema?: WidgetPageSchema;
	/** Draft/not-published state customization */
	draftState?: {
		/** Custom headline shown when widget is not published */
		headline?: string;
		/** Custom body copy shown when widget is not published */
		body?: string;
		/** Custom CTA label */
		ctaLabel?: string;
		/** Custom CTA URL */
		ctaUrl?: string;
	};
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

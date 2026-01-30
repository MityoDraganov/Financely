import type { BaseEntity } from "./base";

export type WidgetDefinitionStatus = "draft" | "published";

export interface WidgetDefinitionData {
	orgId: string;
	name: string;
	status: WidgetDefinitionStatus;
	publishedVersionId: string | null;
	themeRef?: string | null;
}

export type WidgetDefinition = BaseEntity & WidgetDefinitionData;

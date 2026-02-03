import type { BaseEntity } from "./base";
import type { WidgetPage } from "./widget-block-schema";
import type { WidgetVersionActions } from "./widget-block-schema";

export interface WidgetMultiStepOptions {
	showProgressBar?: boolean;
	progressBarPosition?: "top" | "bottom";
	progressStyle?: "steps" | "percentage";
	nextLabel?: string;
	backLabel?: string;
	submitLabel?: string;
}

export interface WidgetVersionData {
	widgetId: string;
	versionNumber: number;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
	multiStepOptions?: WidgetMultiStepOptions;
	createdBy?: string | null;
}

export type WidgetVersion = BaseEntity & WidgetVersionData;

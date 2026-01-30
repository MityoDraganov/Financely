import type { BaseEntity } from "./base";
import type {
	WidgetBlockSchema,
	WidgetVersionActions,
} from "./widget-block-schema";

export interface WidgetVersionData {
	widgetId: string;
	versionNumber: number;
	schema: WidgetBlockSchema;
	actions: WidgetVersionActions;
	createdBy?: string | null;
}

export type WidgetVersion = BaseEntity & WidgetVersionData;

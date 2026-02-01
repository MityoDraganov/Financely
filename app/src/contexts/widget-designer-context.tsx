import { createContext, useContext, type ReactNode } from "react";
import type { WidgetDefinitionListItem } from "@/hooks/repository-hooks/use-widget-definitions";
import type { WidgetPage, WidgetVersionActions } from "@/core/entities/widget-block-schema";

export type WidgetTemplateForCreate = {
	id: string;
	name: string;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
};

export interface WidgetDesignerContextValue {
	definitions: WidgetDefinitionListItem[];
	currentWidgetId: string | undefined;
	setCurrentWidgetId: (id: string | undefined) => void;
	currentDefinition: WidgetDefinitionListItem | undefined;
	onWidgetChange: (id: string) => void;
	onCreateNewWidget: () => void | Promise<void>;
	onCreateFromTemplate: (template: WidgetTemplateForCreate) => Promise<void>;
	isLoadingDefinitions: boolean;
	isCreatingNewWidget: boolean;
}

const WidgetDesignerContext = createContext<WidgetDesignerContextValue | null>(null);

export function WidgetDesignerProvider({
	children,
	definitions,
	currentWidgetId,
	setCurrentWidgetId,
	currentDefinition,
	onWidgetChange,
	onCreateNewWidget,
	onCreateFromTemplate,
	isLoadingDefinitions,
	isCreatingNewWidget,
}: {
	children: ReactNode;
	definitions: WidgetDefinitionListItem[];
	currentWidgetId: string | undefined;
	setCurrentWidgetId: (id: string | undefined) => void;
	currentDefinition: WidgetDefinitionListItem | undefined;
	onWidgetChange: (id: string) => void;
	onCreateNewWidget: () => void | Promise<void>;
	onCreateFromTemplate: (template: WidgetTemplateForCreate) => Promise<void>;
	isLoadingDefinitions: boolean;
	isCreatingNewWidget: boolean;
}) {
	return (
		<WidgetDesignerContext.Provider
			value={{
				definitions,
				currentWidgetId,
				setCurrentWidgetId,
				currentDefinition,
				onWidgetChange,
				onCreateNewWidget,
				onCreateFromTemplate,
				isLoadingDefinitions,
				isCreatingNewWidget,
			}}
		>
			{children}
		</WidgetDesignerContext.Provider>
	);
}

export function useWidgetDesigner() {
	return useContext(WidgetDesignerContext);
}

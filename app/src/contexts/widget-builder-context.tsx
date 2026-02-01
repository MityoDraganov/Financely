import { createContext, useContext, type ReactNode } from "react";
import {
	useWidgetBuilder,
	type UseWidgetBuilderParams,
	type UseWidgetBuilderReturn,
} from "@/hooks/use-widget-builder";

const WidgetBuilderContext = createContext<UseWidgetBuilderReturn | null>(
	null,
);

export interface WidgetBuilderProviderProps extends UseWidgetBuilderParams {
	children: ReactNode;
}

export function WidgetBuilderProvider({
	children,
	effectiveWidgetId,
	organizationId,
	widgetBelongsToOrg,
	onDeleteWidget,
}: WidgetBuilderProviderProps) {
	const value = useWidgetBuilder({
		effectiveWidgetId,
		organizationId,
		widgetBelongsToOrg,
		onDeleteWidget,
	});
	return (
		<WidgetBuilderContext.Provider value={value}>
			{children}
		</WidgetBuilderContext.Provider>
	);
}

export function useWidgetBuilderContext(): UseWidgetBuilderReturn | null {
	return useContext(WidgetBuilderContext);
}

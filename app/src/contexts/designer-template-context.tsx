import { createContext, useContext, ReactNode } from "react";
import type { Template } from "@/core";

interface DesignerTemplateContextValue {
	templates: Template[];
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: Template | undefined;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void;
}

const DesignerTemplateContext = createContext<DesignerTemplateContextValue | null>(null);

export function DesignerTemplateProvider({
	children,
	templates,
	currentTemplateId,
	setCurrentTemplateId,
	currentTemplate,
	onTemplateChange,
	onCreateNewTemplate,
}: {
	children: ReactNode;
	templates: Template[];
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: Template | undefined;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void;
}) {
	return (
		<DesignerTemplateContext.Provider
			value={{
				templates,
				currentTemplateId,
				setCurrentTemplateId,
				currentTemplate,
				onTemplateChange,
				onCreateNewTemplate,
			}}
		>
			{children}
		</DesignerTemplateContext.Provider>
	);
}

export function useDesignerTemplate() {
	const context = useContext(DesignerTemplateContext);
	return context;
}


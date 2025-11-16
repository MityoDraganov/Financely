import { createContext, useContext, ReactNode } from "react";
import type { Template } from "@/core";

interface InvoiceTemplateContextValue {
	templates: Template[];
	selectedTemplateId: string;
	setSelectedTemplateId: (id: string) => void;
	selectedTemplate: Template | undefined;
	previewDialogOpen: boolean;
	setPreviewDialogOpen: (open: boolean) => void;
}

const InvoiceTemplateContext = createContext<InvoiceTemplateContextValue | null>(null);

export function InvoiceTemplateProvider({
	children,
	templates,
	selectedTemplateId,
	setSelectedTemplateId,
	selectedTemplate,
	previewDialogOpen,
	setPreviewDialogOpen,
}: {
	children: ReactNode;
	templates: Template[];
	selectedTemplateId: string;
	setSelectedTemplateId: (id: string) => void;
	selectedTemplate: Template | undefined;
	previewDialogOpen: boolean;
	setPreviewDialogOpen: (open: boolean) => void;
}) {
	return (
		<InvoiceTemplateContext.Provider
			value={{
				templates,
				selectedTemplateId,
				setSelectedTemplateId,
				selectedTemplate,
				previewDialogOpen,
				setPreviewDialogOpen,
			}}
		>
			{children}
		</InvoiceTemplateContext.Provider>
	);
}

export function useInvoiceTemplate() {
	const context = useContext(InvoiceTemplateContext);
	return context;
}


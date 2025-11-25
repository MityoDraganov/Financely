import { createContext, useContext, ReactNode } from "react";
import type { EmailTemplate } from "@/core";

interface EmailDesignerTemplateContextValue {
	templates: EmailTemplate[];
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: EmailTemplate | undefined;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void | Promise<void>;
	isLoadingTemplates: boolean;
	isSubscribed: boolean;
}

const EmailDesignerTemplateContext = createContext<EmailDesignerTemplateContextValue | null>(null);

export function EmailDesignerTemplateProvider({
	children,
	templates,
	currentTemplateId,
	setCurrentTemplateId,
	currentTemplate,
	onTemplateChange,
	onCreateNewTemplate,
	isLoadingTemplates,
	isSubscribed,
}: {
	children: ReactNode;
	templates: EmailTemplate[];
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: EmailTemplate | undefined;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void | Promise<void>;
	isLoadingTemplates: boolean;
	isSubscribed: boolean;
}) {
	return (
		<EmailDesignerTemplateContext.Provider
			value={{
				templates,
				currentTemplateId,
				setCurrentTemplateId,
				currentTemplate,
				onTemplateChange,
				onCreateNewTemplate,
				isLoadingTemplates,
				isSubscribed,
			}}
		>
			{children}
		</EmailDesignerTemplateContext.Provider>
	);
}

export function useEmailDesignerTemplate() {
	const context = useContext(EmailDesignerTemplateContext);
	return context;
}


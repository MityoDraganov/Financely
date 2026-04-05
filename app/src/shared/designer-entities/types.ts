import type { ComponentType, ReactNode } from "react";

export type NavigateOptions = {
	replace?: boolean;
	state?: unknown;
};

export type NavigateFunction = (to: string, options?: NavigateOptions) => void;

export type DesignerRouteKey = "templates" | "designer";
export type EmailDesignerRouteKey = "templates" | "emailDesigner";

export type ResolveDesignerRoutePath = (
	key: DesignerRouteKey,
	templateId?: string,
) => string;

export type ResolveEmailDesignerRoutePath = (
	key: EmailDesignerRouteKey,
	templateId?: string,
) => string;

export const defaultDesignerRoutePathResolver: ResolveDesignerRoutePath = (
	key,
	templateId,
) => {
	if (key === "templates") return "/templates";
	return templateId ? `/designer/${templateId}` : "/designer";
};

export const defaultEmailDesignerRoutePathResolver: ResolveEmailDesignerRoutePath = (
	key,
	templateId,
) => {
	if (key === "templates") return "/templates";
	return templateId ? `/email-designer/${templateId}` : "/email-designer";
};

export interface InvoiceDesignerPageNavigationProps {
	onMissingTemplateRedirect?: () => void;
	resolveRoutePath?: ResolveDesignerRoutePath;
}

export interface EmailDesignerPageNavigationProps {
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (
		templateId: string,
		options?: NavigateOptions,
	) => void;
	resolveRoutePath?: ResolveEmailDesignerRoutePath;
}

export interface LayoutWrapperProps {
	children: ReactNode;
}

export type LayoutWrapperComponent = ComponentType<LayoutWrapperProps>;

export interface InvoiceDesignerProviderProps<TTemplate> {
	children: ReactNode;
	templates: TTemplate[];
	isTemplatesSubscribed: boolean;
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: TTemplate | undefined;
	onTemplateChange: (id: string) => void | Promise<void>;
	onCreateNewTemplate: () => void | Promise<void>;
}

export interface EmailDesignerProviderProps<TTemplate> {
	children: ReactNode;
	templates: TTemplate[];
	currentTemplateId: string | undefined;
	setCurrentTemplateId: (id: string | undefined) => void;
	currentTemplate: TTemplate | undefined;
	onTemplateChange: (id: string) => void | Promise<void>;
	onCreateNewTemplate: () => void | Promise<void>;
	isLoadingTemplates: boolean;
	isSubscribed: boolean;
}

export interface EmailCreateTemplateLocationState {
	templateId?: string;
	action?: "create";
}

export interface CreateEmailTemplateDialogProps<TTemplateType extends string> {
	open: boolean;
	isPending: boolean;
	selectedTemplateType: TTemplateType;
	onSelectedTemplateTypeChange: (value: TTemplateType) => void;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
}

export interface EmailCreateTemplateShape<TTemplateData> {
	mutateAsync: (data: TTemplateData) => Promise<string>;
	isPending: boolean;
	isSuccess: boolean;
}

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ComponentType,
	type ReactNode,
} from "react";
import {
	defaultDesignerRoutePathResolver,
	type InvoiceDesignerPageNavigationProps,
	type InvoiceDesignerProviderProps,
	type LayoutWrapperComponent,
	type NavigateFunction,
	type ResolveDesignerRoutePath,
} from "./types";

interface CreateTemplateShape<TTemplateData> {
	mutateAsync: (data: TTemplateData) => Promise<string>;
}

interface BuildInvoiceTemplateArgs<TTemplate, TOrg> {
	orgId: string;
	templates: TTemplate[];
	currentOrg: TOrg | undefined;
}

export interface InvoiceDesignerEntityProps<TTemplate, TTemplateData, TOrg> {
	templateIdFromUrl?: string;
	navigate: NavigateFunction;
	currentOrg: TOrg | undefined;
	getOrgId: (org: TOrg | undefined) => string;
	templates: TTemplate[];
	isTemplatesSubscribed: boolean;
	getTemplateId: (template: TTemplate) => string;
	createTemplate: CreateTemplateShape<TTemplateData>;
	buildNewTemplateData: (
		args: BuildInvoiceTemplateArgs<TTemplate, TOrg>,
	) => TTemplateData;
	Provider: ComponentType<InvoiceDesignerProviderProps<TTemplate>>;
	PageComponent: ComponentType<InvoiceDesignerPageNavigationProps>;
	LayoutWrapper?: LayoutWrapperComponent;
	resolveRoutePath?: ResolveDesignerRoutePath;
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (templateId: string) => void;
}

export function InvoiceDesignerEntity<TTemplate, TTemplateData, TOrg>({
	templateIdFromUrl,
	navigate,
	currentOrg,
	getOrgId,
	templates,
	isTemplatesSubscribed,
	getTemplateId,
	createTemplate,
	buildNewTemplateData,
	Provider,
	PageComponent,
	LayoutWrapper,
	resolveRoutePath,
	onMissingTemplateRedirect,
	onTemplateCreatedNavigate,
}: InvoiceDesignerEntityProps<TTemplate, TTemplateData, TOrg>) {
	const orgId = getOrgId(currentOrg);
	const resolvedRoutePath = resolveRoutePath ?? defaultDesignerRoutePathResolver;
	const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(
		templateIdFromUrl,
	);

	useEffect(() => {
		if (templateIdFromUrl && templateIdFromUrl !== currentTemplateId) {
			setCurrentTemplateId(templateIdFromUrl);
		}
	}, [templateIdFromUrl, currentTemplateId]);

	const currentTemplate = useMemo(() => {
		if (!currentTemplateId) return undefined;
		return templates.find((template) => getTemplateId(template) === currentTemplateId);
	}, [templates, currentTemplateId, getTemplateId]);

	const handleCreateNewTemplate = useCallback(async () => {
		const templateData = buildNewTemplateData({ orgId, templates, currentOrg });
		const newTemplateId = await createTemplate.mutateAsync(templateData);
		setCurrentTemplateId(newTemplateId);
		if (onTemplateCreatedNavigate) {
			onTemplateCreatedNavigate(newTemplateId);
			return;
		}
		navigate(resolvedRoutePath("designer", newTemplateId), { replace: true });
	}, [
		orgId,
		templates,
		currentOrg,
		buildNewTemplateData,
		createTemplate,
		onTemplateCreatedNavigate,
		navigate,
		resolvedRoutePath,
	]);

	const onTemplateChange = useCallback(
		async (id: string) => {
			if (id === "new") {
				await handleCreateNewTemplate();
				return;
			}
			setCurrentTemplateId(id);
			navigate(resolvedRoutePath("designer", id), { replace: true });
		},
		[handleCreateNewTemplate, navigate, resolvedRoutePath],
	);

	const handleMissingTemplateRedirect = useCallback(() => {
		if (onMissingTemplateRedirect) {
			onMissingTemplateRedirect();
			return;
		}
		navigate(resolvedRoutePath("templates"));
	}, [onMissingTemplateRedirect, navigate, resolvedRoutePath]);

	const content = (
		<Provider
			templates={templates}
			isTemplatesSubscribed={isTemplatesSubscribed}
			currentTemplateId={currentTemplateId}
			setCurrentTemplateId={setCurrentTemplateId}
			currentTemplate={currentTemplate}
			onTemplateChange={onTemplateChange}
			onCreateNewTemplate={handleCreateNewTemplate}
		>
			<PageComponent
				onMissingTemplateRedirect={handleMissingTemplateRedirect}
				resolveRoutePath={resolvedRoutePath}
			/>
		</Provider>
	);

	if (!LayoutWrapper) {
		return content;
	}

	return <LayoutWrapper>{content as ReactNode}</LayoutWrapper>;
}

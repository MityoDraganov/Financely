import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type ReactNode,
} from "react";
import {
	defaultEmailDesignerRoutePathResolver,
	type CreateEmailTemplateDialogProps,
	type EmailCreateTemplateLocationState,
	type EmailCreateTemplateShape,
	type EmailDesignerPageNavigationProps,
	type EmailDesignerProviderProps,
	type LayoutWrapperComponent,
	type NavigateFunction,
	type ResolveEmailDesignerRoutePath,
} from "./types";

interface BuildEmailTemplateArgs<TTemplateType extends string, TOrg> {
	orgId: string;
	templateCount: number;
	selectedTemplateType: TTemplateType;
	currentOrg: TOrg | undefined;
}

export interface EmailDesignerEntityProps<
	TTemplate,
	TTemplateData,
	TOrg,
	TTemplateType extends string,
> {
	templateIdFromUrl?: string;
	locationPathname: string;
	locationState?: EmailCreateTemplateLocationState | null;
	navigate: NavigateFunction;
	currentOrg: TOrg | undefined;
	getOrgId: (org: TOrg | undefined) => string;
	templates: TTemplate[];
	isLoadingTemplates: boolean;
	isSubscribed: boolean;
	getTemplateId: (template: TTemplate) => string;
	createTemplate: EmailCreateTemplateShape<TTemplateData>;
	buildNewTemplateData: (
		args: BuildEmailTemplateArgs<TTemplateType, TOrg>,
	) => TTemplateData;
	initialTemplateType: TTemplateType;
	Provider: ComponentType<EmailDesignerProviderProps<TTemplate>>;
	PageComponent: ComponentType<EmailDesignerPageNavigationProps>;
	CreateTemplateDialogComponent: ComponentType<
		CreateEmailTemplateDialogProps<TTemplateType>
	>;
	LayoutWrapper?: LayoutWrapperComponent;
	ErrorBoundaryWrapper?: LayoutWrapperComponent;
	resolveRoutePath?: ResolveEmailDesignerRoutePath;
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (templateId: string) => void;
}

export function EmailDesignerEntity<
	TTemplate,
	TTemplateData,
	TOrg,
	TTemplateType extends string,
>({
	templateIdFromUrl,
	locationPathname,
	locationState,
	navigate,
	currentOrg,
	getOrgId,
	templates,
	isLoadingTemplates,
	isSubscribed,
	getTemplateId,
	createTemplate,
	buildNewTemplateData,
	initialTemplateType,
	Provider,
	PageComponent,
	CreateTemplateDialogComponent,
	LayoutWrapper,
	ErrorBoundaryWrapper,
	resolveRoutePath,
	onMissingTemplateRedirect,
	onTemplateCreatedNavigate,
}: EmailDesignerEntityProps<TTemplate, TTemplateData, TOrg, TTemplateType>) {
	const orgId = getOrgId(currentOrg);
	const resolvedRoutePath = resolveRoutePath ?? defaultEmailDesignerRoutePathResolver;
	const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(
		templateIdFromUrl,
	);
	const hasHandledCreateActionRef = useRef(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [createDialogOrigin, setCreateDialogOrigin] = useState<
		"route" | "designer"
	>("designer");
	const [selectedTemplateType, setSelectedTemplateType] = useState<TTemplateType>(
		initialTemplateType,
	);
	const createDialogResolverRef = useRef<((created: boolean) => void) | null>(null);

	const isRouteCreationWizard =
		createDialogOpen && createDialogOrigin === "route" && !templateIdFromUrl;

	useEffect(() => {
		if (templateIdFromUrl && templateIdFromUrl !== currentTemplateId) {
			setCurrentTemplateId(templateIdFromUrl);
		}
	}, [templateIdFromUrl, currentTemplateId]);

	useEffect(() => {
		if (locationState?.templateId) {
			setCurrentTemplateId(locationState.templateId);
		}
	}, [locationState?.templateId]);

	const currentTemplate = useMemo(() => {
		if (!currentTemplateId) return undefined;
		return templates.find((template) => getTemplateId(template) === currentTemplateId);
	}, [templates, currentTemplateId, getTemplateId]);

	const resolveCreateDialog = useCallback((created: boolean) => {
		if (!createDialogResolverRef.current) return;
		createDialogResolverRef.current(created);
		createDialogResolverRef.current = null;
	}, []);

	const openCreateTemplateWizard = useCallback(
		(origin: "route" | "designer") => {
			if (createDialogResolverRef.current) {
				return Promise.resolve(false);
			}
			setCreateDialogOrigin(origin);
			setSelectedTemplateType(initialTemplateType);
			setCreateDialogOpen(true);
			return new Promise<boolean>((resolve) => {
				createDialogResolverRef.current = resolve;
			});
		},
		[initialTemplateType],
	);

	const handleCreateNewTemplate = useCallback(async () => {
		if (!orgId) return;
		await openCreateTemplateWizard("designer");
	}, [orgId, openCreateTemplateWizard]);

	const handleCancelCreateTemplate = useCallback(() => {
		setCreateDialogOpen(false);
		resolveCreateDialog(false);
		if (createDialogOrigin === "route" && !templateIdFromUrl) {
			navigate(resolvedRoutePath("templates"), { replace: true });
		}
	}, [
		createDialogOrigin,
		navigate,
		resolveCreateDialog,
		templateIdFromUrl,
		resolvedRoutePath,
	]);

	const handleTemplateCreatedNavigate = useCallback(
		(templateId: string, replace = true) => {
			if (onTemplateCreatedNavigate) {
				onTemplateCreatedNavigate(templateId);
				return;
			}
			navigate(resolvedRoutePath("emailDesigner", templateId), {
				replace,
			});
		},
		[onTemplateCreatedNavigate, navigate, resolvedRoutePath],
	);

	const handleConfirmCreateTemplate = useCallback(async () => {
		if (!orgId) return;
		const templateData = buildNewTemplateData({
			orgId,
			templateCount: templates.length,
			selectedTemplateType,
			currentOrg,
		});
		try {
			const newTemplateId = await createTemplate.mutateAsync(templateData);
			setCurrentTemplateId(newTemplateId);
			setCreateDialogOpen(false);
			resolveCreateDialog(true);
			handleTemplateCreatedNavigate(newTemplateId, true);
		} catch (error) {
			console.error("Failed to create email template:", error);
		}
	}, [
		orgId,
		templates.length,
		selectedTemplateType,
		currentOrg,
		buildNewTemplateData,
		createTemplate,
		resolveCreateDialog,
		handleTemplateCreatedNavigate,
	]);

	const onTemplateChange = useCallback(
		async (id: string) => {
			if (id === "new") {
				await handleCreateNewTemplate();
				return;
			}
			setCurrentTemplateId(id);
			navigate(resolvedRoutePath("emailDesigner", id), { replace: true });
		},
		[handleCreateNewTemplate, navigate, resolvedRoutePath],
	);

	useEffect(() => {
		if (
			locationState?.action === "create" &&
			!createTemplate.isPending &&
			!hasHandledCreateActionRef.current
		) {
			hasHandledCreateActionRef.current = true;
			openCreateTemplateWizard("route").finally(() => {
				window.history.replaceState({}, "", locationPathname);
			});
		}
		if (!locationState?.action || createTemplate.isSuccess) {
			hasHandledCreateActionRef.current = false;
		}
	}, [
		locationState?.action,
		createTemplate.isPending,
		createTemplate.isSuccess,
		openCreateTemplateWizard,
		locationPathname,
	]);

	const pageMissingTemplateRedirect = useCallback(() => {
		if (!onMissingTemplateRedirect) return;
		onMissingTemplateRedirect();
	}, [onMissingTemplateRedirect]);

	const content = (
		<Provider
			templates={templates}
			currentTemplateId={currentTemplateId}
			setCurrentTemplateId={setCurrentTemplateId}
			currentTemplate={currentTemplate}
			onTemplateChange={onTemplateChange}
			onCreateNewTemplate={handleCreateNewTemplate}
			isLoadingTemplates={isLoadingTemplates}
			isSubscribed={isSubscribed}
		>
			{isRouteCreationWizard ? (
				<div className="py-10 px-6">
					<p className="text-sm text-muted-foreground">
						Select a template type to start creating your email template.
					</p>
				</div>
			) : (
				<PageComponent
					onMissingTemplateRedirect={pageMissingTemplateRedirect}
					onTemplateCreatedNavigate={(templateId, options) => {
						handleTemplateCreatedNavigate(templateId, options?.replace ?? true);
					}}
					resolveRoutePath={resolvedRoutePath}
				/>
			)}
			<CreateTemplateDialogComponent
				open={createDialogOpen}
				isPending={createTemplate.isPending}
				selectedTemplateType={selectedTemplateType}
				onSelectedTemplateTypeChange={setSelectedTemplateType}
				onOpenChange={(open) => {
					if (createTemplate.isPending) return;
					if (!open) {
						handleCancelCreateTemplate();
						return;
					}
					setCreateDialogOpen(true);
				}}
				onConfirm={handleConfirmCreateTemplate}
				onCancel={handleCancelCreateTemplate}
			/>
		</Provider>
	);

	const withLayout = LayoutWrapper ? (
		<LayoutWrapper>{content as ReactNode}</LayoutWrapper>
	) : (
		content
	);

	if (!ErrorBoundaryWrapper) {
		return withLayout;
	}

	return <ErrorBoundaryWrapper>{withLayout as ReactNode}</ErrorBoundaryWrapper>;
}

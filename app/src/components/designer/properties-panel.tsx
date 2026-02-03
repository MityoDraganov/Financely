import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Template, TemplateData, TemplateElement, TemplateVersion } from "@/core";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import type { UseMutationResult } from "@tanstack/react-query";
import { ComplianceStatus } from "./compliance-status";
import { WatermarkConfig } from "./watermark-config";
import { TemplateVersionHistory } from "./template-version-history";
import { ProductTableConfigPanel } from "./product-table-config-panel";
import {
	TextProperties,
	ImageProperties,
	BoxProperties,
	LineProperties,
	TableProperties,
	InputProperties,
} from "@/components/designer/elements";
import { CurrencyProperties } from "@/components/designer/elements/currency";
import type { Organization } from "@/core";
import { typography, spacing, separators, components, colors } from "./design-system";

type PropertiesPanelProps = {
	template: Template | undefined;
	selectedElementIds: string[];
	draftElements: TemplateElement[] | null;
	organization: Organization | undefined;
	complianceStatus: {
		region: string;
		valid: boolean;
		missingBindings: string[];
	} | null;
	saveMutation: UseMutationResult<void, Error, Partial<TemplateData>, unknown>;
	onUpdateElement: (partial: Partial<TemplateElement>) => void;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table" | "currency") => void;
	determineElementTypeForBinding: (binding: string, format?: "string" | "number" | "date" | "boolean" | "object" | "array") => "text" | "input" | "table" | "currency";
	onOpenImagePicker?: (elementId: string) => void;
	onPropsNarrowChange?: (isNarrow: boolean) => void;
	// Version history props
	templateId?: string;
	versions?: TemplateVersion[];
	currentVersion?: number | null;
	onRestoreVersion?: (version: number) => Promise<void>;
	isRestoringVersion?: boolean;
	currentUserId?: string;
};

const PROPS_NARROW_BREAKPOINT_PX = 520;

export function PropertiesPanel({
	template,
	selectedElementIds,
	draftElements,
	organization,
	complianceStatus,
	saveMutation,
	onUpdateElement,
	onAddRequiredElement,
	determineElementTypeForBinding,
	onOpenImagePicker,
	onPropsNarrowChange,
	templateId,
	versions = [],
	currentVersion,
	onRestoreVersion,
	isRestoringVersion,
	currentUserId,
}: PropertiesPanelProps) {
	const { t } = useTranslation();
	const propertiesRef = useRef<HTMLDivElement>(null);
	const elementPropertiesRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = propertiesRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const isNarrow = entry.contentRect.width < PROPS_NARROW_BREAKPOINT_PX;
				onPropsNarrowChange?.(isNarrow);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [onPropsNarrowChange]);

	// Scroll to element properties when an element is selected
	useEffect(() => {
		if (selectedElementIds.length > 0 && elementPropertiesRef.current && propertiesRef.current) {
			// Use setTimeout to ensure the element is rendered before scrolling
			const timeoutId = setTimeout(() => {
				const container = propertiesRef.current;
				const target = elementPropertiesRef.current;
				if (container && target) {
					// Calculate the scroll position to show the element properties section
					const containerRect = container.getBoundingClientRect();
					const targetRect = target.getBoundingClientRect();
					const scrollTop = container.scrollTop;
					const targetTop = targetRect.top - containerRect.top + scrollTop;
					
					// Scroll with smooth behavior, offset by a small amount for better visibility
					container.scrollTo({
						top: targetTop - 16, // 16px offset for better visibility
						behavior: "smooth",
					});
				}
			}, 50); // Small delay to ensure DOM is updated

			return () => clearTimeout(timeoutId);
		}
	}, [selectedElementIds]);

	if (!template) {
		return (
			<div
				ref={propertiesRef}
				className={`h-full ${spacing.panelPadding} border-l ${colors.bgDefault} overflow-auto min-w-0`}
			>
				<h2 className={typography.sectionTitle}>{t('designer.propertiesPanel.title')}</h2>
				<p className={`${typography.helperText} mt-2`}>
					{t('designer.propertiesPanel.createTemplate')}
				</p>
			</div>
		);
	}

	const elements = draftElements ?? template.elements ?? [];
	const selectedElements = selectedElementIds.length > 0
		? elements.filter((e) => selectedElementIds.includes(e.id))
		: [];
	const selectedElement = selectedElements.length === 1 ? selectedElements[0] : undefined;
	const hasBlockSelected = selectedElement != null;

	const templatePropertiesContent = (
		<div className={spacing.sectionGap}>
			{complianceStatus && (
				<ComplianceStatus
					complianceStatus={complianceStatus}
					template={template}
					onAddRequiredElement={onAddRequiredElement}
					determineElementTypeForBinding={determineElementTypeForBinding}
				/>
			)}
			<section className={components.section}>
				<h3 className={typography.sectionTitle}>{t('designer.propertiesPanel.template')}</h3>
				<div className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.name')}</Label>
						<Input
							value={template.name}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								saveMutation.mutate({ name: e.target.value })
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.pageSize')}</Label>
						<Select
							value={template.pageSize}
							onValueChange={(v: string) =>
								saveMutation.mutate({ pageSize: v as TemplateData["pageSize"] })
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="A4">A4</SelectItem>
								<SelectItem value="Letter">Letter</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>
			<section className={`${components.section} ${separators.sectionDivider}`}>
				<h3 className={typography.sectionTitle}>{t('designer.propertiesPanel.compliance')}</h3>
				<div className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.region')}</Label>
						<Select
							value={template.compliance?.region || (organization ? invoiceComplianceService.detectRegion(organization) : "US")}
							onValueChange={(v: string) => {
								const currentCompliance = template.compliance || {
									region: "US" as const,
									requiredFields: [],
									autoFooter: true,
									complianceValidated: false,
								};
								saveMutation.mutate({
									compliance: {
										...currentCompliance,
										region: v as "US" | "EU" | "CA" | "AU" | "UK",
										complianceValidated: false,
									},
								});
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="US">🇺🇸 United States</SelectItem>
								<SelectItem value="EU">🇪🇺 European Union</SelectItem>
								<SelectItem value="CA">🇨🇦 Canada</SelectItem>
								<SelectItem value="AU">🇦🇺 Australia</SelectItem>
								<SelectItem value="UK">🇬🇧 United Kingdom</SelectItem>
							</SelectContent>
						</Select>
						<p className={typography.helperText}>
							{t('designer.propertiesPanel.regionDescription')}
						</p>
					</div>
				</div>
			</section>
			<WatermarkConfig
				template={template}
				organizationLogo={organization?.settings?.branding?.customLogo}
				saveMutation={saveMutation}
			/>
			{templateId && onRestoreVersion && (
				<div className={separators.sectionDivider}>
					<TemplateVersionHistory
						templateId={templateId}
						versions={versions}
						currentVersion={currentVersion ?? null}
						onRestoreVersion={onRestoreVersion}
						isRestoring={isRestoringVersion ?? false}
						currentUserId={currentUserId}
					/>
				</div>
			)}
		</div>
	);

	const blockPropertiesContent = selectedElement && (
		<div className={spacing.sectionGap}>
			{selectedElement.type === "table" && selectedElement.itemsBinding && (
				<div className={separators.sectionDivider}>
					<ProductTableConfigPanel
						template={template}
						selectedTable={selectedElement}
						onSave={(config) => saveMutation.mutate({ productTableConfig: config })}
						isSaving={saveMutation.isPending}
					/>
				</div>
			)}
			<div ref={elementPropertiesRef} className={selectedElement.type === "table" && selectedElement.itemsBinding ? separators.sectionDivider : undefined}>
				<ElementProperties
					element={selectedElement}
					onChange={onUpdateElement}
					allElements={elements}
					onOpenImagePicker={onOpenImagePicker}
				/>
			</div>
		</div>
	);

	return (
		<div
			ref={propertiesRef}
			className={`h-full flex flex-col ${spacing.panelPadding} border-l ${colors.bgDefault} overflow-hidden min-w-0`}
		>
			<h2 className={`${typography.sectionTitle} shrink-0`}>{t('designer.propertiesPanel.title')}</h2>
			{hasBlockSelected ? (
				<Tabs defaultValue="block" className="flex-1 flex flex-col min-h-0 gap-2">
					<TabsList className="w-full shrink-0">
						<TabsTrigger value="block" className="flex-1">{t('designer.propertiesPanel.block', 'Block')}</TabsTrigger>
						<TabsTrigger value="template" className="flex-1">{t('designer.propertiesPanel.templateTab', 'Template')}</TabsTrigger>
					</TabsList>
					<TabsContent value="block" className="flex-1 overflow-auto min-h-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
						{blockPropertiesContent}
					</TabsContent>
					<TabsContent value="template" className="flex-1 overflow-auto min-h-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
						{templatePropertiesContent}
					</TabsContent>
				</Tabs>
			) : (
				<div className="flex-1 overflow-auto min-h-0">{templatePropertiesContent}</div>
			)}
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
	allElements,
	onOpenImagePicker,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
	allElements?: TemplateElement[];
	onOpenImagePicker?: (elementId: string) => void;
}) {
	if (element.type === "text") {
		const t = element as Extract<TemplateElement, { type: "text" }>;
		return (
			<TextProperties
				element={t}
				onChange={onChange}
				allElements={allElements}
			/>
		);
	}

	if (element.type === "image") {
		const img = element as Extract<TemplateElement, { type: "image" }>;
		return (
			<ImageProperties
				element={img}
				onChange={onChange}
				allElements={allElements}
				onOpenImagePicker={onOpenImagePicker}
			/>
		);
	}

	if (element.type === "box") {
		const bx = element as Extract<TemplateElement, { type: "box" }>;
		return <BoxProperties element={bx} onChange={onChange} />;
	}

	if (element.type === "line") {
		const ln = element as Extract<TemplateElement, { type: "line" }>;
		return <LineProperties element={ln} onChange={onChange} />;
	}

	if (element.type === "table") {
		const tbl = element as Extract<TemplateElement, { type: "table" }>;
		return (
			<TableProperties
				element={tbl}
				onChange={onChange}
				allElements={allElements}
			/>
		);
	}

	if (element.type === "input") {
		const inp = element as Extract<TemplateElement, { type: "input" }>;
		return (
			<InputProperties
				element={inp}
				onChange={onChange}
				allElements={allElements}
			/>
		);
	}

	if (element.type === "currency") {
		const curr = element as Extract<TemplateElement, { type: "currency" }>;
		return (
			<CurrencyProperties
				element={curr}
				onChange={onChange}
				allElements={allElements}
			/>
		);
	}

	return (
		<div className={typography.helperText}>
			Select an element to edit.
		</div>
	);
}


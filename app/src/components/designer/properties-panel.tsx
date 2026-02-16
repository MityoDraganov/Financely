import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
	IconProperties,
	TableProperties,
	InputProperties,
	PathProperties,
} from "@/components/designer/elements";
import { CurrencyProperties } from "@/components/designer/elements/currency";
import type { Organization } from "@/core";
import { typography, spacing, separators, components, colors } from "./design-system";
import {
	DEFAULT_MARGIN_UNIT,
	type MarginUnit,
	getDefaultPrintMarginsPx,
	marginUnitToPx,
	pxToMarginUnit,
	resolveTemplateMarginsPx,
} from "@/utils/print-margins";
import {
	DEFAULT_BOX_MODEL_STYLE,
	ELEMENT_BOX_MODEL_UNITS,
	normalizeBoxModelStyle,
	type ElementBoxModelStyle,
	type ElementMeasuredLength,
} from "@/utils/element-box-model";

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
	editingPathElementId?: string;
	activePathTool?: "select" | "pen";
	onPathEditModeChange?: (elementId: string, enabled: boolean) => void;
	onPathToolChange?: (tool: "select" | "pen") => void;
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
	editingPathElementId,
	activePathTool,
	onPathEditModeChange,
	onPathToolChange,
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
	const currentMargins = resolveTemplateMarginsPx(
		template.pageSettings?.margins,
		template.brand?.margins
	);
	const marginUnit: MarginUnit = template.pageSettings?.marginUnit === "cm" ? "cm" : DEFAULT_MARGIN_UNIT;

	const buildNextPageSettings = (
		patch: Partial<NonNullable<Template["pageSettings"]>> = {}
	): NonNullable<Template["pageSettings"]> => {
		const merged = {
			size: template.pageSettings?.size ?? template.pageSize,
			orientation: template.pageSettings?.orientation ?? "portrait",
			margins: currentMargins,
			marginUnit,
			padding: template.pageSettings?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 },
			customSize: template.pageSettings?.customSize,
			backgroundColor: template.pageSettings?.backgroundColor,
			backgroundImage: template.pageSettings?.backgroundImage,
			backgroundOpacity: template.pageSettings?.backgroundOpacity,
			...patch,
		};

		// Firebase Realtime Database rejects undefined values in update payloads.
		return {
			size: merged.size,
			orientation: merged.orientation,
			margins: merged.margins,
			marginUnit: merged.marginUnit,
			padding: merged.padding,
			...(merged.size === "Custom" && merged.customSize ? { customSize: merged.customSize } : {}),
			...(typeof merged.backgroundColor === "string" ? { backgroundColor: merged.backgroundColor } : {}),
			...(typeof merged.backgroundImage === "string" ? { backgroundImage: merged.backgroundImage } : {}),
			...(typeof merged.backgroundOpacity === "number" ? { backgroundOpacity: merged.backgroundOpacity } : {}),
		};
	};

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
							value={template.pageSettings?.size ?? template.pageSize}
							onValueChange={(v: string) => {
								if (v === "A4" || v === "Letter" || v === "Legal") {
									saveMutation.mutate({
										pageSize: v as TemplateData["pageSize"],
										pageSettings: buildNextPageSettings({
											size: v,
										}),
									});
									return;
								}

								saveMutation.mutate({
									pageSettings: buildNextPageSettings({
										size: "Custom",
										customSize: template.pageSettings?.customSize ?? { width: 794, height: 1123 },
									}),
								});
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
								<SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
								<SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
								<SelectItem value="Custom">Custom</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.orientation', 'Orientation')}</Label>
						<Select
							value={template.pageSettings?.orientation ?? "portrait"}
							onValueChange={(v: string) =>
								saveMutation.mutate({
									pageSettings: buildNextPageSettings({
										orientation: v as "portrait" | "landscape",
									}),
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="portrait">Portrait</SelectItem>
								<SelectItem value="landscape">Landscape</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={`${components.field} col-span-full`}>
						<div className="flex items-center justify-between mb-2">
							<Label className={typography.fieldLabel}>Margins</Label>
							<Select
								value={marginUnit}
								onValueChange={(v: string) =>
									saveMutation.mutate({
										pageSettings: buildNextPageSettings({
											marginUnit: (v === "cm" ? "cm" : "in") as MarginUnit,
										}),
									})
								}
							>
								<SelectTrigger className="h-8 w-24">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="in">in</SelectItem>
									<SelectItem value="cm">cm</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className={components.grid}>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Top</Label>
								<Input
									type="number"
									step={marginUnit === "cm" ? "0.1" : "0.05"}
									min={0}
									value={Number(pxToMarginUnit(currentMargins.top, marginUnit).toFixed(2))}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
										const next = Number(e.target.value);
										if (!Number.isFinite(next)) return;
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												margins: {
													...currentMargins,
													top: Math.max(0, marginUnitToPx(next, marginUnit)),
												},
											}),
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Right</Label>
								<Input
									type="number"
									step={marginUnit === "cm" ? "0.1" : "0.05"}
									min={0}
									value={Number(pxToMarginUnit(currentMargins.right, marginUnit).toFixed(2))}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
										const next = Number(e.target.value);
										if (!Number.isFinite(next)) return;
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												margins: {
													...currentMargins,
													right: Math.max(0, marginUnitToPx(next, marginUnit)),
												},
											}),
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Bottom</Label>
								<Input
									type="number"
									step={marginUnit === "cm" ? "0.1" : "0.05"}
									min={0}
									value={Number(pxToMarginUnit(currentMargins.bottom, marginUnit).toFixed(2))}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
										const next = Number(e.target.value);
										if (!Number.isFinite(next)) return;
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												margins: {
													...currentMargins,
													bottom: Math.max(0, marginUnitToPx(next, marginUnit)),
												},
											}),
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Left</Label>
								<Input
									type="number"
									step={marginUnit === "cm" ? "0.1" : "0.05"}
									min={0}
									value={Number(pxToMarginUnit(currentMargins.left, marginUnit).toFixed(2))}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
										const next = Number(e.target.value);
										if (!Number.isFinite(next)) return;
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												margins: {
													...currentMargins,
													left: Math.max(0, marginUnitToPx(next, marginUnit)),
												},
											}),
										});
									}}
									className={components.inputHeight}
								/>
							</div>
						</div>
						<div className="mt-2 flex items-center justify-between gap-2">
							<p className={typography.helperText}>
								Standard print margin is 1 in (2.54 cm) on all sides.
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() =>
									saveMutation.mutate({
										pageSettings: buildNextPageSettings({
											margins: getDefaultPrintMarginsPx(),
										}),
									})
								}
							>
								Use Standard
							</Button>
						</div>
					</div>
					{template.pageSettings?.size === "Custom" && (
						<>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.customWidth', 'Custom Width')}</Label>
								<Input
									type="number"
									value={template.pageSettings?.customSize?.width ?? 794}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												size: "Custom",
												customSize: {
													width: Number(e.target.value),
													height: template.pageSettings?.customSize?.height ?? 1123,
												},
											}),
										})
									}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.customHeight', 'Custom Height')}</Label>
								<Input
									type="number"
									value={template.pageSettings?.customSize?.height ?? 1123}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										saveMutation.mutate({
											pageSettings: buildNextPageSettings({
												size: "Custom",
												customSize: {
													width: template.pageSettings?.customSize?.width ?? 794,
													height: Number(e.target.value),
												},
											}),
										})
									}
									className={components.inputHeight}
								/>
							</div>
						</>
					)}
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.propertiesPanel.pageBackground', 'Page Background')}</Label>
						<Input
							type="color"
							value={template.pageSettings?.backgroundColor ?? "#ffffff"}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
								saveMutation.mutate({
									pageSettings: buildNextPageSettings({
										backgroundColor: e.target.value,
									}),
								})
							}
							className={components.inputHeight}
						/>
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
			<div className={components.section}>
				<UniversalBoxModelProperties
					element={selectedElement}
					onChange={onUpdateElement}
				/>
			</div>
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
					editingPathElementId={editingPathElementId}
					activePathTool={activePathTool}
					onPathEditModeChange={onPathEditModeChange}
					onPathToolChange={onPathToolChange}
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

function UniversalBoxModelProperties({
	element,
	onChange,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
}) {
	const paddingStyle = normalizeBoxModelStyle(
		(element.paddingStyle as Partial<ElementBoxModelStyle> | undefined) ?? DEFAULT_BOX_MODEL_STYLE
	);
	const borderRadiusStyle = normalizeBoxModelStyle(
		(element.borderRadiusStyle as Partial<ElementBoxModelStyle> | undefined) ?? DEFAULT_BOX_MODEL_STYLE
	);

	return (
		<section className={components.section}>
			<h3 className={typography.sectionTitle}>Box Model</h3>
			<div className={components.subsection}>
				<BoxModelStyleEditor
					label="Padding"
					value={paddingStyle}
					onChange={(next) => onChange({ paddingStyle: next })}
				/>
				<BoxModelStyleEditor
					label="Border Radius"
					value={borderRadiusStyle}
					onChange={(next) => onChange({ borderRadiusStyle: next })}
				/>
			</div>
		</section>
	);
}

function BoxModelStyleEditor({
	label,
	value,
	onChange,
}: {
	label: string;
	value: ElementBoxModelStyle;
	onChange: (next: ElementBoxModelStyle) => void;
}) {
	const normalized = normalizeBoxModelStyle(value);

	const updateAll = (patch: Partial<ElementMeasuredLength>) => {
		onChange({
			...normalized,
			all: {
				...normalized.all,
				...patch,
			},
		});
	};

	const updateSide = (
		side: keyof ElementBoxModelStyle["values"],
		patch: Partial<ElementMeasuredLength>
	) => {
		onChange({
			...normalized,
			values: {
				...normalized.values,
				[side]: {
					...normalized.values[side],
					...patch,
				},
			},
		});
	};

	return (
		<div className={components.card}>
			<div className="flex items-center justify-between gap-2">
				<Label className={typography.fieldLabel}>{label}</Label>
				<Select
					value={normalized.mode}
					onValueChange={(mode) =>
						onChange({
							...normalized,
							mode: mode === "custom" ? "custom" : "all",
						})
					}
				>
					<SelectTrigger className="h-8 w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">1 value (all sides)</SelectItem>
						<SelectItem value="custom">Separate values</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{normalized.mode === "all" ? (
				<div className={`${components.field} mt-3`}>
					<Label className={typography.fieldLabel}>All Sides</Label>
					<div className="flex gap-2">
						<Input
							type="number"
							step="0.1"
							value={normalized.all.value}
							onChange={(e) => updateAll({ value: Number(e.target.value) || 0 })}
							className={components.inputHeight}
						/>
						<Select
							value={normalized.all.unit}
							onValueChange={(unit) => updateAll({ unit: unit as ElementMeasuredLength["unit"] })}
						>
							<SelectTrigger className="h-9 w-24">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ELEMENT_BOX_MODEL_UNITS.map((unit) => (
									<SelectItem key={unit} value={unit}>
										{unit}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			) : (
				<div className={`${components.grid} mt-3`}>
					{(["top", "right", "bottom", "left"] as const).map((side) => (
						<div key={side} className={components.field}>
							<Label className={typography.fieldLabel}>
								{side.charAt(0).toUpperCase() + side.slice(1)}
							</Label>
							<div className="flex gap-2">
								<Input
									type="number"
									step="0.1"
									value={normalized.values[side].value}
									onChange={(e) => updateSide(side, { value: Number(e.target.value) || 0 })}
									className={components.inputHeight}
								/>
								<Select
									value={normalized.values[side].unit}
									onValueChange={(unit) =>
										updateSide(side, { unit: unit as ElementMeasuredLength["unit"] })
									}
								>
									<SelectTrigger className="h-9 w-24">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ELEMENT_BOX_MODEL_UNITS.map((unit) => (
											<SelectItem key={unit} value={unit}>
												{unit}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
	allElements,
	onOpenImagePicker,
	editingPathElementId,
	activePathTool,
	onPathEditModeChange,
	onPathToolChange,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
	allElements?: TemplateElement[];
	onOpenImagePicker?: (elementId: string) => void;
	editingPathElementId?: string;
	activePathTool?: "select" | "pen";
	onPathEditModeChange?: (elementId: string, enabled: boolean) => void;
	onPathToolChange?: (tool: "select" | "pen") => void;
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

	if (element.type === "icon") {
		const iconEl = element as Extract<TemplateElement, { type: "icon" }>;
		return <IconProperties element={iconEl} onChange={onChange} />;
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

	if (element.type === "path") {
		return (
			<PathProperties
				element={element as Extract<TemplateElement, { type: "path" }>}
				onChange={onChange}
				isEditing={editingPathElementId === element.id}
				activeTool={activePathTool}
				onEditToggle={(enabled: boolean) => onPathEditModeChange?.(element.id, enabled)}
				onToolChange={onPathToolChange}
			/>
		);
	}

	if (
		element.type === "spacer" ||
		element.type === "pageBreak" ||
		element.type === "qrCode" ||
		element.type === "barcode" ||
		element.type === "signature" ||
		element.type === "stamp"
	) {
		return (
			<BasicElementProperties
				element={element}
				onChange={onChange}
			/>
		);
	}

	return (
		<div className={typography.helperText}>
			Select an element to edit.
		</div>
	);
}

function BasicElementProperties({
	element,
	onChange,
}: {
	element: Extract<
		TemplateElement,
		{ type: "spacer" | "pageBreak" | "qrCode" | "barcode" | "signature" | "stamp" }
	>;
	onChange: (partial: Partial<TemplateElement>) => void;
}) {
	const titleByType: Record<typeof element.type, string> = {
		spacer: "Spacer",
		pageBreak: "Page Break",
		qrCode: "QR Code",
		barcode: "Barcode",
		signature: "Signature",
		stamp: "Stamp",
	};

	return (
		<div className={components.section}>
			<h3 className={typography.sectionTitle}>{titleByType[element.type]}</h3>
			<section className={components.subsection}>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>X</Label>
						<Input type="number" value={element.x} onChange={(e) => onChange({ x: Number(e.target.value) })} className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Y</Label>
						<Input type="number" value={element.y} onChange={(e) => onChange({ y: Number(e.target.value) })} className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Width</Label>
						<Input type="number" value={element.width} onChange={(e) => onChange({ width: Number(e.target.value) })} className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Height</Label>
						<Input type="number" value={element.height} onChange={(e) => onChange({ height: Number(e.target.value) })} className={components.inputHeight} />
					</div>
				</div>
			</section>
			{element.type === "qrCode" && (
				<section className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Content</Label>
						<Input value={element.content} onChange={(e) => onChange({ content: e.target.value })} className={components.inputHeight} />
					</div>
				</section>
			)}
			{element.type === "barcode" && (
				<section className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Value</Label>
						<Input value={element.value} onChange={(e) => onChange({ value: e.target.value })} className={components.inputHeight} />
					</div>
				</section>
			)}
			{element.type === "signature" && (
				<section className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Placeholder</Label>
						<Input value={element.placeholderText} onChange={(e) => onChange({ placeholderText: e.target.value })} className={components.inputHeight} />
					</div>
				</section>
			)}
			{element.type === "stamp" && (
				<section className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Text</Label>
						<Input value={element.text} onChange={(e) => onChange({ text: e.target.value })} className={components.inputHeight} />
					</div>
				</section>
			)}
		</div>
	);
}

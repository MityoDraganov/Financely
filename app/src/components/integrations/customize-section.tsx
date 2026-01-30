import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
	Sparkles,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Type,
	Palette,
	Layout,
	Layers,
	Plus,
	GripVertical,
	MessageSquare,
	Receipt,
	FileText,
	Trash2,
	Pencil,
	Globe,
} from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { WidgetLocalizationAccordion } from "@/components/site-builder/widget-localization-accordion";
import type {
	WidgetStyling,
	WidgetLocalization,
	BuiltInFields,
	CustomField,
	ContactFormConfig,
	InvoiceRequestConfig,
	QuoteRequestConfig,
	WidgetPosition,
	WidgetFieldType,
} from "@/components/site-builder/widget-types";

export type WidgetType = "contact" | "invoice" | "quote";

interface CustomizeSectionProps {
	activeWidget: WidgetType;
	onWidgetChange: (widget: WidgetType) => void;
	// Contact form
	contactFormConfig: ContactFormConfig;
	onContactFormConfigChange: (config: ContactFormConfig) => void;
	contactFormStyling: WidgetStyling;
	onContactFormStylingChange: (styling: WidgetStyling) => void;
	builtInFields: BuiltInFields;
	onBuiltInFieldsChange: (fields: BuiltInFields) => void;
	customFields: CustomField[];
	onAddCustomField: () => void;
	onRemoveCustomField: (id: string) => void;
	onUpdateCustomField: (id: string, updates: Partial<CustomField>) => void;
	onCustomFieldsChange: (fields: CustomField[]) => void;
	// Localization
	contactFormLocalization: WidgetLocalization;
	onContactFormLocalizationChange: (localization: WidgetLocalization) => void;
	invoiceRequestLocalization: WidgetLocalization;
	onInvoiceRequestLocalizationChange: (localization: WidgetLocalization) => void;
	quoteRequestLocalization: WidgetLocalization;
	onQuoteRequestLocalizationChange: (localization: WidgetLocalization) => void;
	organizationId?: string;
	// Invoice request
	invoiceRequestConfig: InvoiceRequestConfig;
	onInvoiceRequestConfigChange: (config: InvoiceRequestConfig) => void;
	invoiceRequestStyling: WidgetStyling;
	onInvoiceRequestStylingChange: (styling: WidgetStyling) => void;
	// Quote request
	quoteRequestConfig: QuoteRequestConfig;
	onQuoteRequestConfigChange: (config: QuoteRequestConfig) => void;
	quoteRequestStyling: WidgetStyling;
	onQuoteRequestStylingChange: (styling: WidgetStyling) => void;
	// AI Builder
	onOpenAiBuilder: () => void;
	// Save
	onSave: () => void;
	isSaving: boolean;
}

const widgetConfigs = {
	contact: {
		label: "Contact Form",
		icon: MessageSquare,
	},
	invoice: {
		label: "Invoice Request",
		icon: Receipt,
	},
	quote: {
		label: "Quote Request",
		icon: FileText,
	},
};

export function CustomizeSection({
	activeWidget,
	onWidgetChange,
	contactFormConfig,
	onContactFormConfigChange,
	contactFormStyling,
	onContactFormStylingChange,
	builtInFields,
	onBuiltInFieldsChange,
	customFields,
	onAddCustomField,
	onRemoveCustomField,
	onUpdateCustomField,
	onCustomFieldsChange,
	contactFormLocalization,
	onContactFormLocalizationChange,
	invoiceRequestLocalization,
	onInvoiceRequestLocalizationChange,
	quoteRequestLocalization,
	onQuoteRequestLocalizationChange,
	organizationId,
	invoiceRequestConfig,
	onInvoiceRequestConfigChange,
	invoiceRequestStyling,
	onInvoiceRequestStylingChange,
	quoteRequestConfig,
	onQuoteRequestConfigChange,
	quoteRequestStyling,
	onQuoteRequestStylingChange,
	onOpenAiBuilder,
	onSave,
	isSaving,
}: CustomizeSectionProps) {
	const { t } = useTranslation();
	const [expandedSections, setExpandedSections] = useState<string[]>([
		"content",
		"styling",
	]);
	const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

	const toggleSection = (section: string) => {
		setExpandedSections((prev) =>
			prev.includes(section)
				? prev.filter((s) => s !== section)
				: [...prev, section]
		);
	};

	// Get current config based on active widget
	const getCurrentConfig = () => {
		switch (activeWidget) {
			case "contact":
				return contactFormConfig;
			case "invoice":
				return invoiceRequestConfig;
			case "quote":
				return quoteRequestConfig;
		}
	};

	const getCurrentStyling = () => {
		switch (activeWidget) {
			case "contact":
				return contactFormStyling;
			case "invoice":
				return invoiceRequestStyling;
			case "quote":
				return quoteRequestStyling;
		}
	};

	const updateCurrentConfig = (updates: Partial<ContactFormConfig | InvoiceRequestConfig | QuoteRequestConfig>) => {
		switch (activeWidget) {
			case "contact":
				onContactFormConfigChange({ ...contactFormConfig, ...updates } as ContactFormConfig);
				break;
			case "invoice":
				onInvoiceRequestConfigChange({ ...invoiceRequestConfig, ...updates } as InvoiceRequestConfig);
				break;
			case "quote":
				onQuoteRequestConfigChange({ ...quoteRequestConfig, ...updates } as QuoteRequestConfig);
				break;
		}
	};

	const updateCurrentStyling = (updates: Partial<WidgetStyling>) => {
		switch (activeWidget) {
			case "contact":
				onContactFormStylingChange({ ...contactFormStyling, ...updates });
				break;
			case "invoice":
				onInvoiceRequestStylingChange({ ...invoiceRequestStyling, ...updates });
				break;
			case "quote":
				onQuoteRequestStylingChange({ ...quoteRequestStyling, ...updates });
				break;
		}
	};

	const currentConfig = getCurrentConfig();
	const currentStyling = getCurrentStyling();

	const SectionHeader = ({
		id,
		icon: Icon,
		title,
		description,
	}: {
		id: string;
		icon: React.ElementType;
		title: string;
		description: string;
	}) => (
		<button
			onClick={() => toggleSection(id)}
			className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
		>
			<div className="flex items-center gap-3">
				<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
					<Icon className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="text-left">
					<h3 className="text-sm font-medium text-foreground">{title}</h3>
					<p className="text-xs text-muted-foreground">{description}</p>
				</div>
			</div>
			{expandedSections.includes(id) ? (
				<ChevronDown className="h-4 w-4 text-muted-foreground" />
			) : (
				<ChevronRight className="h-4 w-4 text-muted-foreground" />
			)}
		</button>
	);

	return (
		<div className="space-y-6">
			{/* Widget Type Tabs */}
			<div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
				{(
					Object.entries(widgetConfigs) as [
						WidgetType,
						(typeof widgetConfigs)["contact"],
					][]
				).map(([key, config]) => (
					<button
						key={key}
						onClick={() => onWidgetChange(key)}
						className={cn(
							"flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
							activeWidget === key
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:text-foreground"
						)}
					>
						<config.icon className="h-4 w-4" />
						{t(`siteBuilder.aiWidgetDialog.widgetTypes.${key === "contact" ? "contactForm" : key === "invoice" ? "invoiceRequest" : "quoteRequest"}`)}
					</button>
				))}
			</div>

			{/* AI Generator Banner */}
			<div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
				<div className="relative flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
							<Sparkles className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h3 className="text-sm font-medium text-foreground">
								{t("siteBuilder.aiWidgetDialog.title")}
							</h3>
							<p className="text-xs text-muted-foreground">
								{t("siteBuilder.aiWidgetDialog.description")}
							</p>
						</div>
					</div>
					<Button
						size="sm"
						onClick={onOpenAiBuilder}
					>
						{t("siteBuilder.aiWidgetDialog.generateWidget")}
					</Button>
				</div>
			</div>

			{/* Enable Widget Toggle */}
			<div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
				<div>
					<p className="text-sm font-medium text-foreground">
						{t("siteBuilder.widgets.enableWidget", "Enable Widget")}
					</p>
					<p className="text-xs text-muted-foreground">
						{t("siteBuilder.widgets.enableWidgetDesc", "Show this widget on your website")}
					</p>
				</div>
				<Switch
					checked={currentConfig.enabled}
					onCheckedChange={(enabled) => updateCurrentConfig({ enabled })}
				/>
			</div>

			{/* Content Section */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<SectionHeader
					id="content"
					icon={Type}
					title={t("siteBuilder.customize.contentCopy", "Content & Copy")}
					description={t("siteBuilder.customize.contentCopyDesc", "Widget text, labels, and messages")}
				/>
				{expandedSections.includes("content") && (
					<div className="border-t border-border p-4 space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									{t("siteBuilder.widgets.title", "Title")}
								</label>
								<Input
									value={currentConfig.title}
									onChange={(e) => updateCurrentConfig({ title: e.target.value })}
									className="bg-background"
								/>
							</div>
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									{t("siteBuilder.widgets.submitButtonText", "Button Text")}
								</label>
								<Input
									value={currentConfig.submitButtonText}
									onChange={(e) => updateCurrentConfig({ submitButtonText: e.target.value })}
									className="bg-background"
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								{t("siteBuilder.widgets.description", "Description")} ({t("common.optional", "Optional")})
							</label>
							<Textarea
								value={currentConfig.description}
								onChange={(e) => updateCurrentConfig({ description: e.target.value })}
								placeholder={t("siteBuilder.widgets.descriptionPlaceholder", "Enter a description for your widget...")}
								className="bg-background min-h-[80px] resize-none"
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-muted-foreground">
								{t("siteBuilder.widgets.successMessage", "Success Message")}
							</label>
							<Input
								value={currentConfig.successMessage}
								onChange={(e) => updateCurrentConfig({ successMessage: e.target.value })}
								className="bg-background"
							/>
						</div>
					</div>
				)}
			</div>

			{/* Styling Section */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<SectionHeader
					id="styling"
					icon={Palette}
					title={t("siteBuilder.customize.stylingAppearance", "Styling & Appearance")}
					description={t("siteBuilder.customize.stylingAppearanceDesc", "Colors, typography, and visual settings")}
				/>
				{expandedSections.includes("styling") && (
					<div className="border-t border-border p-4 space-y-5">
						{/* Colors */}
						<div className="space-y-3">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								{t("siteBuilder.styling.colors", "Colors")}
							</h4>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{[
									{ key: "primaryColor", label: t("siteBuilder.styling.primary", "Primary") },
									{ key: "secondaryColor", label: t("siteBuilder.widgets.styling.secondaryColor", "Secondary") },
									{ key: "backgroundColor", label: t("siteBuilder.styling.background", "Background") },
									{ key: "textColor", label: t("siteBuilder.styling.text", "Text") },
									{ key: "borderColor", label: t("siteBuilder.widgets.styling.borderColor", "Border") },
									{ key: "errorColor", label: t("siteBuilder.widgets.styling.errorColor", "Error") },
									{ key: "successColor", label: t("siteBuilder.widgets.styling.successColor", "Success") },
								].map(({ key, label }) => (
									<div key={key} className="space-y-1.5">
										<label className="text-xs text-muted-foreground">{label}</label>
										<div className="flex items-center gap-2">
											<input
												type="color"
												value={currentStyling[key as keyof WidgetStyling] as string}
												onChange={(e) => updateCurrentStyling({ [key]: e.target.value })}
												className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
											/>
											<Input
												value={currentStyling[key as keyof WidgetStyling] as string}
												onChange={(e) => updateCurrentStyling({ [key]: e.target.value })}
												className="flex-1 bg-background font-mono text-xs"
											/>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Typography */}
						<div className="space-y-3">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								{t("siteBuilder.widgets.styling.typography", "Typography")}
							</h4>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.fontFamily", "Font Family")}</label>
									<Input
										value={currentStyling.fontFamily}
										onChange={(e) => updateCurrentStyling({ fontFamily: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.fontSize", "Font Size")}</label>
									<Input
										value={currentStyling.fontSize}
										onChange={(e) => updateCurrentStyling({ fontSize: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.fontWeight", "Font Weight")}</label>
									<select
										value={currentStyling.fontWeight}
										onChange={(e) => updateCurrentStyling({ fontWeight: e.target.value })}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										<option value="300">{t("siteBuilder.widgets.styling.fontWeightLight", "Light")}</option>
										<option value="400">{t("siteBuilder.widgets.styling.fontWeightNormal", "Normal")}</option>
										<option value="500">{t("siteBuilder.widgets.styling.fontWeightMedium", "Medium")}</option>
										<option value="600">{t("siteBuilder.widgets.styling.fontWeightSemiBold", "Semi Bold")}</option>
										<option value="700">{t("siteBuilder.widgets.styling.fontWeightBold", "Bold")}</option>
									</select>
								</div>
							</div>
						</div>

						{/* Spacing */}
						<div className="space-y-3">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								{t("siteBuilder.widgets.styling.spacing", "Spacing")}
							</h4>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.padding", "Padding")}</label>
									<Input
										value={currentStyling.padding}
										onChange={(e) => updateCurrentStyling({ padding: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.gap", "Gap")}</label>
									<Input
										value={currentStyling.gap}
										onChange={(e) => updateCurrentStyling({ gap: e.target.value })}
										className="bg-background"
									/>
								</div>
							</div>
						</div>

						{/* Buttons */}
						<div className="space-y-3">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								{t("siteBuilder.widgets.styling.buttons", "Buttons")}
							</h4>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.buttonPadding", "Button Padding")}</label>
									<Input
										value={currentStyling.buttonPadding}
										onChange={(e) => updateCurrentStyling({ buttonPadding: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.buttonBorderRadius", "Button Radius")}</label>
									<Input
										value={currentStyling.buttonBorderRadius}
										onChange={(e) => updateCurrentStyling({ buttonBorderRadius: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.buttonFontWeight", "Button Weight")}</label>
									<select
										value={currentStyling.buttonFontWeight}
										onChange={(e) => updateCurrentStyling({ buttonFontWeight: e.target.value })}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										<option value="400">Normal</option>
										<option value="500">Medium</option>
										<option value="600">Semi Bold</option>
										<option value="700">Bold</option>
									</select>
								</div>
							</div>
						</div>

						{/* Modal */}
						<div className="space-y-3">
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								{t("siteBuilder.widgets.styling.modal", "Modal")}
							</h4>
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.modalBackdropOpacity", "Backdrop Opacity")}</label>
									<Input
										value={currentStyling.modalBackdropOpacity}
										onChange={(e) => updateCurrentStyling({ modalBackdropOpacity: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.modalBorderRadius", "Modal Radius")}</label>
									<Input
										value={currentStyling.modalBorderRadius}
										onChange={(e) => updateCurrentStyling({ modalBorderRadius: e.target.value })}
										className="bg-background"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.modalMaxWidth", "Max Width")}</label>
									<Input
										value={currentStyling.modalMaxWidth}
										onChange={(e) => updateCurrentStyling({ modalMaxWidth: e.target.value })}
										className="bg-background"
									/>
								</div>
							</div>
						</div>

						{/* Shadow */}
						<div className="space-y-1.5">
							<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.styling.shadow", "Shadow")}</label>
							<Input
								value={currentStyling.shadow}
								onChange={(e) => updateCurrentStyling({ shadow: e.target.value })}
								className="bg-background font-mono text-xs"
							/>
						</div>

						{/* Page background (shareable link) */}
						<div className="space-y-1.5">
							<label className="text-xs text-muted-foreground">
								{t("siteBuilder.widgets.styling.pageBackground", "Page background (shareable link)")}
							</label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={currentStyling.pageBackgroundColor ?? "#f8fafc"}
									onChange={(e) => updateCurrentStyling({ pageBackgroundColor: e.target.value })}
									className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
								/>
								<Input
									value={currentStyling.pageBackgroundColor ?? ""}
									onChange={(e) => updateCurrentStyling({ pageBackgroundColor: e.target.value || undefined })}
									placeholder={t("siteBuilder.widgets.styling.pageBackgroundPlaceholder", "Leave empty for primary tint")}
									className="flex-1 bg-background font-mono text-xs"
								/>
							</div>
						</div>

						{/* Border Radius */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
									{t("siteBuilder.styling.borderRadius", "Border Radius")}
								</h4>
								<span className="text-xs text-muted-foreground font-mono">
									{currentStyling.borderRadius}
								</span>
							</div>
							<Slider
								value={[parseInt(currentStyling.borderRadius) || 8]}
								onValueChange={([value]) => updateCurrentStyling({ borderRadius: `${value}px` })}
								max={24}
								step={1}
								className="w-full"
							/>
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>{t("siteBuilder.styling.sharp", "Sharp")}</span>
								<span>{t("siteBuilder.styling.rounded", "Rounded")}</span>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Layout Section */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<SectionHeader
					id="layout"
					icon={Layout}
					title={t("siteBuilder.customize.layoutPosition", "Layout & Position")}
					description={t("siteBuilder.customize.layoutPositionDesc", "Display mode and placement settings")}
				/>
				{expandedSections.includes("layout") && (
					<div className="border-t border-border p-4 space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							{activeWidget === "contact" && (
								<div className="space-y-1.5">
									<label className="text-xs font-medium text-muted-foreground">
										{t("siteBuilder.widgets.displayMode", "Display Mode")}
									</label>
									<select
										value={(currentConfig as ContactFormConfig).displayMode}
										onChange={(e) => updateCurrentConfig({ displayMode: e.target.value as "floating" | "inline" })}
										className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										<option value="floating">{t("siteBuilder.widgets.floating", "Floating Button")}</option>
										<option value="inline">{t("siteBuilder.widgets.inline", "Inline")}</option>
									</select>
								</div>
							)}
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-muted-foreground">
									{t("siteBuilder.widgets.position", "Position")}
								</label>
								<select
									value={currentConfig.position}
									onChange={(e) => updateCurrentConfig({ position: e.target.value as WidgetPosition })}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
								>
									<option value="bottom-right">{t("siteBuilder.widgets.positions.bottomRight", "Bottom Right")}</option>
									<option value="bottom-left">{t("siteBuilder.widgets.positions.bottomLeft", "Bottom Left")}</option>
									<option value="top-right">{t("siteBuilder.widgets.positions.topRight", "Top Right")}</option>
									<option value="top-left">{t("siteBuilder.widgets.positions.topLeft", "Top Left")}</option>
									<option value="center">{t("siteBuilder.widgets.positions.center", "Center")}</option>
								</select>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Localization Section */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<SectionHeader
					id="localization"
					icon={Globe}
					title={t("siteBuilder.widgets.localization.title", "Languages")}
					description={t("siteBuilder.widgets.localization.description", "Translate widget text for multiple languages")}
				/>
				{expandedSections.includes("localization") && organizationId && (
					<div className="border-t border-border p-4">
						<Accordion type="single" collapsible defaultValue="localization" className="w-full">
							{activeWidget === "contact" && (
								<WidgetLocalizationAccordion
									localization={contactFormLocalization}
									onLocalizationChange={onContactFormLocalizationChange}
									widgetType="contactForm"
									config={{
										title: contactFormConfig.title,
										description: contactFormConfig.description,
										submitButtonText: contactFormConfig.submitButtonText,
										successMessage: contactFormConfig.successMessage,
										organizationId,
									}}
									builtInFields={builtInFields}
									customFields={customFields}
								/>
							)}
							{activeWidget === "invoice" && (
								<WidgetLocalizationAccordion
									localization={invoiceRequestLocalization}
									onLocalizationChange={onInvoiceRequestLocalizationChange}
									widgetType="invoiceRequest"
									config={{
										title: invoiceRequestConfig.title,
										description: invoiceRequestConfig.description,
										submitButtonText: invoiceRequestConfig.submitButtonText,
										successMessage: invoiceRequestConfig.successMessage,
										organizationId,
									}}
								/>
							)}
							{activeWidget === "quote" && (
								<WidgetLocalizationAccordion
									localization={quoteRequestLocalization}
									onLocalizationChange={onQuoteRequestLocalizationChange}
									widgetType="quoteRequest"
									config={{
										title: quoteRequestConfig.title,
										description: quoteRequestConfig.description,
										submitButtonText: quoteRequestConfig.submitButtonText,
										successMessage: quoteRequestConfig.successMessage,
										organizationId,
									}}
								/>
							)}
						</Accordion>
					</div>
				)}
				{expandedSections.includes("localization") && !organizationId && (
					<div className="border-t border-border p-4 text-sm text-muted-foreground">
						{t("siteBuilder.widgets.localization.organizationRequired", "Organization is required for localization.")}
					</div>
				)}
			</div>

			{/* Fields Section (Contact Form only) */}
			{activeWidget === "contact" && (
				<div className="rounded-xl border border-border bg-card overflow-hidden">
					<SectionHeader
						id="fields"
						icon={Layers}
						title={t("siteBuilder.customize.formFields", "Form Fields")}
						description={t("siteBuilder.customize.formFieldsDesc", "Configure built-in and custom fields")}
					/>
					{expandedSections.includes("fields") && (
						<div className="border-t border-border p-4 space-y-4">
							{/* Built-in Fields */}
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
									{t("siteBuilder.widgets.builtInFields", "Built-in Fields")}
								</h4>
								{(["name", "email", "phone", "company", "message"] as const).map((fieldKey) => (
									<div
										key={fieldKey}
										className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
									>
										<div className="flex items-center gap-3">
											<GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
											<span className="text-sm text-foreground">
												{builtInFields[fieldKey].label}
											</span>
											{builtInFields[fieldKey].required && (
												<Badge
													variant="secondary"
													className="text-[10px] bg-muted text-muted-foreground border-0"
												>
													{t("common.required", "Required")}
												</Badge>
											)}
										</div>
										<div className="flex items-center gap-3">
											<label className="flex items-center gap-2 text-xs text-muted-foreground">
												<Switch
													checked={builtInFields[fieldKey].enabled}
													onCheckedChange={(enabled) =>
														onBuiltInFieldsChange({
															...builtInFields,
															[fieldKey]: { ...builtInFields[fieldKey], enabled },
														})
													}
													className="scale-75"
												/>
												{t("common.enabled", "Enabled")}
											</label>
										</div>
									</div>
								))}
							</div>

							{/* Custom Fields */}
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
									{t("siteBuilder.widgets.customFields", "Custom Fields")}
								</h4>
								{customFields.length > 0 ? (
									customFields.map((field, index) => (
										<div
											key={field.id}
											className="rounded-lg border border-border bg-background overflow-hidden"
										>
											<div className="flex items-center justify-between p-3 gap-2">
												<div className="flex items-center gap-2 min-w-0">
													<div className="flex flex-col gap-0.5">
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 cursor-grab"
															onClick={() => {
																if (index > 0) {
																	const next = [...customFields];
																	[next[index - 1], next[index]] = [next[index], next[index - 1]];
																	onCustomFieldsChange(next.map((f, i) => ({ ...f, order: i })));
																}
															}}
															disabled={index === 0}
														>
															<ChevronUp className="h-3.5 w-3.5" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 cursor-grab"
															onClick={() => {
																if (index < customFields.length - 1) {
																	const next = [...customFields];
																	[next[index], next[index + 1]] = [next[index + 1], next[index]];
																	onCustomFieldsChange(next.map((f, i) => ({ ...f, order: i })));
																}
															}}
															disabled={index === customFields.length - 1}
														>
															<ChevronDown className="h-3.5 w-3.5" />
														</Button>
													</div>
													<GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
													<span className="text-sm text-foreground truncate">{field.label}</span>
													<Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground border-0 shrink-0">
														{field.type}
													</Badge>
												</div>
												<div className="flex items-center gap-1 shrink-0">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
													>
														<Pencil className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive hover:text-destructive"
														onClick={() => {
															if (window.confirm(t("siteBuilder.widgets.confirmDeleteField", "Delete this field?"))) {
																onRemoveCustomField(field.id);
																if (editingFieldId === field.id) setEditingFieldId(null);
															}
														}}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>
											{editingFieldId === field.id && (
												<div className="border-t border-border p-3 space-y-3 bg-muted/20">
													<div className="grid gap-3 sm:grid-cols-2">
														<div className="space-y-1.5">
															<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.fieldName", "Field name (key)")}</label>
															<Input
																value={field.name}
																onChange={(e) => onUpdateCustomField(field.id, { name: e.target.value })}
																className="bg-background"
															/>
														</div>
														<div className="space-y-1.5">
															<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.fieldLabel", "Label")}</label>
															<Input
																value={field.label}
																onChange={(e) => onUpdateCustomField(field.id, { label: e.target.value })}
																className="bg-background"
															/>
														</div>
													</div>
													<div className="grid gap-3 sm:grid-cols-2">
														<div className="space-y-1.5">
															<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.fieldType", "Type")}</label>
															<select
																value={field.type}
																onChange={(e) => onUpdateCustomField(field.id, { type: e.target.value as WidgetFieldType })}
																className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
															>
																{(["text", "email", "tel", "textarea", "number", "select", "checkbox", "date"] as const).map((type) => (
																	<option key={type} value={type}>{type}</option>
																))}
															</select>
														</div>
														<div className="space-y-1.5 flex items-end pb-2">
															<label className="flex items-center gap-2 text-xs text-muted-foreground">
																<Switch
																	checked={field.required}
																	onCheckedChange={(required) => onUpdateCustomField(field.id, { required })}
																	className="scale-75"
																/>
																{t("common.required", "Required")}
															</label>
														</div>
													</div>
													<div className="space-y-1.5">
														<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.placeholder", "Placeholder")}</label>
														<Input
															value={field.placeholder ?? ""}
															onChange={(e) => onUpdateCustomField(field.id, { placeholder: e.target.value || undefined })}
															className="bg-background"
															placeholder={t("common.optional", "Optional")}
														/>
													</div>
													{field.type === "select" && (
														<div className="space-y-1.5">
															<label className="text-xs text-muted-foreground">{t("siteBuilder.widgets.options", "Options (comma-separated)")}</label>
															<Input
																value={(field.options ?? []).join(", ")}
																onChange={(e) =>
																	onUpdateCustomField(field.id, {
																		options: e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
																	})
																}
																className="bg-background"
																placeholder="Option 1, Option 2, ..."
															/>
														</div>
													)}
												</div>
											)}
										</div>
									))
								) : null}
								<div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 p-3">
									<span className="text-sm text-muted-foreground">
										{t("siteBuilder.widgets.addCustomFieldsDesc", "Add custom fields to collect more data")}
									</span>
									<Button
										variant="outline"
										size="sm"
										className="gap-2 bg-transparent"
										onClick={onAddCustomField}
									>
										<Plus className="h-3.5 w-3.5" />
										{t("siteBuilder.widgets.addField", "Add Field")}
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Save Button */}
			<div className="flex items-center justify-end gap-3 pt-2">
				<Button onClick={onSave} disabled={isSaving}>
					{isSaving
						? t("siteBuilder.createSiteDialog.creating", "Saving...")
						: t("siteBuilder.widgets.saveConfiguration")}
				</Button>
			</div>
		</div>
	);
}

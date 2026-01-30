import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Monitor,
	Smartphone,
	Tablet,
	RotateCcw,
	Maximize2,
	History,
	Eye,
} from "lucide-react";
import type { WidgetStyling, ContactFormConfig, InvoiceRequestConfig, QuoteRequestConfig, BuiltInFields } from "@/components/site-builder/widget-types";

export type WidgetType = "contact" | "invoice" | "quote";
type ViewMode = "desktop" | "tablet" | "mobile";

interface WidgetPreviewPanelProps {
	activeWidget: WidgetType;
	currentVersion?: number | null;
	onViewHistory?: () => void;
	// Contact form
	contactFormConfig: ContactFormConfig;
	contactFormStyling: WidgetStyling;
	builtInFields: BuiltInFields;
	// Invoice request
	invoiceRequestConfig: InvoiceRequestConfig;
	invoiceRequestStyling: WidgetStyling;
	// Quote request
	quoteRequestConfig: QuoteRequestConfig;
	quoteRequestStyling: WidgetStyling;
}

const viewModes: { value: ViewMode; icon: React.ElementType; label: string }[] =
	[
		{ value: "desktop", icon: Monitor, label: "Desktop" },
		{ value: "tablet", icon: Tablet, label: "Tablet" },
		{ value: "mobile", icon: Smartphone, label: "Mobile" },
	];

export function WidgetPreviewPanel({
	activeWidget,
	currentVersion,
	onViewHistory,
	contactFormConfig,
	contactFormStyling,
	builtInFields,
	invoiceRequestConfig,
	invoiceRequestStyling,
	quoteRequestConfig,
	quoteRequestStyling,
}: WidgetPreviewPanelProps) {
	const { t } = useTranslation();
	const [viewMode, setViewMode] = useState<ViewMode>("desktop");

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

	const config = getCurrentConfig();
	const styling = getCurrentStyling();

	return (
		<div className="rounded-xl border border-border bg-card overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border p-3">
				<div className="flex items-center gap-2">
					<Eye className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium text-foreground">
						{t("siteBuilder.preview.livePreview", "Live Preview")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					{viewModes.map((mode) => (
						<button
							key={mode.value}
							onClick={() => setViewMode(mode.value)}
							className={cn(
								"flex h-7 w-7 items-center justify-center rounded-md transition-colors",
								viewMode === mode.value
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:text-foreground"
							)}
							title={mode.label}
						>
							<mode.icon className="h-3.5 w-3.5" />
						</button>
					))}
					<div className="mx-1 h-4 w-px bg-border" />
					<button
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
						title={t("siteBuilder.preview.reset", "Reset")}
					>
						<RotateCcw className="h-3.5 w-3.5" />
					</button>
					<button
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
						title={t("siteBuilder.preview.fullscreen", "Fullscreen")}
					>
						<Maximize2 className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>

			{/* Preview Area */}
			<div className="bg-muted/50 dark:bg-muted/20 p-6">
				<div
					className={cn(
						"mx-auto rounded-lg transition-all duration-300",
						viewMode === "desktop" && "w-full",
						viewMode === "tablet" && "w-[320px]",
						viewMode === "mobile" && "w-[280px]"
					)}
					style={{
						backgroundColor: styling.backgroundColor,
						borderRadius: styling.modalBorderRadius,
						boxShadow: styling.shadow,
					}}
				>
					{/* Widget Preview */}
					<div className="p-5">
						<WidgetFormPreview
							config={config}
							styling={styling}
							widgetType={activeWidget}
							builtInFields={activeWidget === "contact" ? builtInFields : undefined}
						/>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
				<button
					onClick={onViewHistory}
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<History className="h-3.5 w-3.5" />
					{t("siteBuilder.widgets.versionHistory", "Version History")}
				</button>
				{currentVersion && (
					<Badge
						variant="secondary"
						className="text-[10px] bg-muted text-muted-foreground border-0"
					>
						v{currentVersion} - {t("common.current", "Current")}
					</Badge>
				)}
			</div>
		</div>
	);
}

interface WidgetFormPreviewProps {
	config: ContactFormConfig | InvoiceRequestConfig | QuoteRequestConfig;
	styling: WidgetStyling;
	widgetType: WidgetType;
	builtInFields?: BuiltInFields;
}

function WidgetFormPreview({ config, styling, widgetType, builtInFields }: WidgetFormPreviewProps) {
	const inputStyle: React.CSSProperties = {
		backgroundColor: styling.backgroundColor,
		borderColor: styling.borderColor,
		color: styling.textColor,
		fontSize: styling.fontSize,
		fontFamily: styling.fontFamily,
		borderRadius: styling.borderRadius,
	};

	const labelStyle: React.CSSProperties = {
		color: styling.textColor,
		fontSize: "11px",
		fontFamily: styling.fontFamily,
	};

	const buttonStyle: React.CSSProperties = {
		backgroundColor: styling.primaryColor,
		color: styling.backgroundColor,
		fontFamily: styling.fontFamily,
		fontWeight: styling.buttonFontWeight,
		borderRadius: styling.buttonBorderRadius,
		padding: styling.buttonPadding,
	};

	const renderFields = () => {
		if (widgetType === "contact" && builtInFields) {
			return (
				<>
					{builtInFields.name.enabled && (
						<div className="space-y-1">
							<label style={labelStyle} className="font-medium">
								{builtInFields.name.label}
								{builtInFields.name.required && <span style={{ color: styling.errorColor }}> *</span>}
							</label>
							<Input
								placeholder="John Doe"
								className="h-8 text-xs"
								style={inputStyle}
								disabled
							/>
						</div>
					)}
					{builtInFields.email.enabled && (
						<div className="space-y-1">
							<label style={labelStyle} className="font-medium">
								{builtInFields.email.label}
								{builtInFields.email.required && <span style={{ color: styling.errorColor }}> *</span>}
							</label>
							<Input
								type="email"
								placeholder="john@example.com"
								className="h-8 text-xs"
								style={inputStyle}
								disabled
							/>
						</div>
					)}
					{builtInFields.phone.enabled && (
						<div className="space-y-1">
							<label style={labelStyle} className="font-medium">
								{builtInFields.phone.label}
								{builtInFields.phone.required && <span style={{ color: styling.errorColor }}> *</span>}
							</label>
							<Input
								type="tel"
								placeholder="+1 (555) 000-0000"
								className="h-8 text-xs"
								style={inputStyle}
								disabled
							/>
						</div>
					)}
					{builtInFields.company.enabled && (
						<div className="space-y-1">
							<label style={labelStyle} className="font-medium">
								{builtInFields.company.label}
								{builtInFields.company.required && <span style={{ color: styling.errorColor }}> *</span>}
							</label>
							<Input
								placeholder="Acme Inc."
								className="h-8 text-xs"
								style={inputStyle}
								disabled
							/>
						</div>
					)}
					{builtInFields.message.enabled && (
						<div className="space-y-1">
							<label style={labelStyle} className="font-medium">
								{builtInFields.message.label}
								{builtInFields.message.required && <span style={{ color: styling.errorColor }}> *</span>}
							</label>
							<Textarea
								placeholder="How can we help?"
								className="min-h-[60px] text-xs resize-none"
								style={inputStyle}
								disabled
							/>
						</div>
					)}
				</>
			);
		}

		// Default fields for invoice/quote
		return (
			<>
				<div className="space-y-1">
					<label style={labelStyle} className="font-medium">
						{widgetType === "invoice" ? "Company Name" : "Name"} <span style={{ color: styling.errorColor }}>*</span>
					</label>
					<Input
						placeholder={widgetType === "invoice" ? "Acme Inc." : "Your name"}
						className="h-8 text-xs"
						style={inputStyle}
						disabled
					/>
				</div>
				<div className="space-y-1">
					<label style={labelStyle} className="font-medium">
						Email <span style={{ color: styling.errorColor }}>*</span>
					</label>
					<Input
						type="email"
						placeholder={widgetType === "invoice" ? "billing@acme.com" : "you@company.com"}
						className="h-8 text-xs"
						style={inputStyle}
						disabled
					/>
				</div>
				<div className="space-y-1">
					<label style={labelStyle} className="font-medium">
						{widgetType === "invoice" ? "Details" : "Project Description"}
					</label>
					<Textarea
						placeholder={widgetType === "invoice" ? "Invoice details..." : "Tell us about your project..."}
						className="min-h-[60px] text-xs resize-none"
						style={inputStyle}
						disabled
					/>
				</div>
			</>
		);
	};

	return (
		<div className="space-y-4">
			<div>
				<h3
					className="text-base font-semibold"
					style={{ color: styling.textColor, fontFamily: styling.fontFamily }}
				>
					{config.title}
				</h3>
				{config.description && (
					<p
						className="text-xs mt-0.5"
						style={{ color: styling.secondaryColor, fontFamily: styling.fontFamily }}
					>
						{config.description}
					</p>
				)}
			</div>

			<div className="space-y-3">
				{renderFields()}
			</div>

			<Button size="sm" className="w-full text-xs" style={buttonStyle} disabled>
				{config.submitButtonText}
			</Button>
		</div>
	);
}

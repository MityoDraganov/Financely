import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Template, TemplateData, TemplateElement } from "@/core";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import type { UseMutationResult } from "@tanstack/react-query";
import { ComplianceStatus } from "./compliance-status";
import { WatermarkConfig } from "./watermark-config";
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

type PropertiesPanelProps = {
	template: Template | undefined;
	selectedElementId: string | undefined;
	draftElements: TemplateElement[] | null;
	organization: Organization | undefined;
	complianceStatus: {
		region: string;
		valid: boolean;
		missingBindings: string[];
	} | null;
	saveMutation: UseMutationResult<void, Error, Partial<TemplateData>, unknown>;
	onUpdateElement: (partial: Partial<TemplateElement>) => void;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table") => void;
	determineElementTypeForBinding: (binding: string, format?: "string" | "number" | "date" | "boolean" | "object" | "array") => "text" | "input" | "table";
	onPropsNarrowChange?: (isNarrow: boolean) => void;
};

const PROPS_NARROW_BREAKPOINT_PX = 520;

export function PropertiesPanel({
	template,
	selectedElementId,
	draftElements,
	organization,
	complianceStatus,
	saveMutation,
	onUpdateElement,
	onAddRequiredElement,
	determineElementTypeForBinding,
	onPropsNarrowChange,
}: PropertiesPanelProps) {
	const propertiesRef = useRef<HTMLDivElement>(null);

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

	if (!template) {
		return (
			<div
				ref={propertiesRef}
				className="h-full p-3 border-l bg-neutral-50 space-y-3 overflow-auto min-w-0"
			>
				<div className="font-medium">Properties</div>
				<div className="text-sm text-neutral-500">
					Create a template to begin.
				</div>
			</div>
		);
	}

	const elements = draftElements ?? template.elements ?? [];
	const selectedElement = selectedElementId
		? elements.find((e) => e.id === selectedElementId)
		: undefined;

	return (
		<div
			ref={propertiesRef}
			className="h-full p-3 border-l bg-neutral-50 space-y-3 overflow-auto min-w-0"
		>
			<div className="font-medium">Properties</div>
			<div className="space-y-4">
				{/* Compliance Status Indicator */}
				{complianceStatus && (
					<ComplianceStatus
						complianceStatus={complianceStatus}
						template={template}
						onAddRequiredElement={onAddRequiredElement}
						determineElementTypeForBinding={determineElementTypeForBinding}
					/>
				)}
				{/* Template Properties */}
				<div>
					<div className="text-xs text-neutral-500 mb-1">Name</div>
					<Input
						value={template.name}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							saveMutation.mutate({
								name: e.target.value,
							})
						}
					/>
				</div>
				<div>
					<div className="text-xs text-neutral-500 mb-1">Page Size</div>
					<Select
						value={template.pageSize}
						onValueChange={(v: string) =>
							saveMutation.mutate({
								pageSize: v as TemplateData["pageSize"],
							})
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="A4">A4</SelectItem>
							<SelectItem value="Letter">Letter</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{/* Compliance Region */}
				<div>
					<div className="text-xs text-neutral-500 mb-1">Compliance Region</div>
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
						<SelectTrigger>
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
					<p className="text-xs text-neutral-400 mt-1">
						Determines which compliance requirements apply
					</p>
				</div>
				{/* Watermark Configuration */}
				<WatermarkConfig
					template={template}
					organizationLogo={organization?.settings?.branding?.customLogo}
					saveMutation={saveMutation}
				/>
				{/* Element Properties */}
				{selectedElement && (
					<ElementProperties
						element={selectedElement}
						onChange={onUpdateElement}
						allElements={elements}
					/>
				)}
			</div>
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
	allElements,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
	allElements?: TemplateElement[];
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
		<div className="text-xs text-neutral-500">
			Select an element to edit.
		</div>
	);
}


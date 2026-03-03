import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TemplateElement } from "@/core";
import { typography, spacing, separators, components } from "../design-system";
import { GoogleFontPicker } from "@/components/designer/google-font-picker";
import { FieldCombobox } from "@/components/designer/field-combobox";

interface TextElementProps {
	element: Extract<TemplateElement, { type: "text" }>;
	zoom: number;
}

export default function TextElement({ element, zoom }: TextElementProps) {
	const t = element;
	
	const shadowStyle = t.shadow?.enabled
		? {
				boxShadow: `${t.shadow.offsetX}px ${t.shadow.offsetY}px ${t.shadow.blur}px ${t.shadow.color}`,
			}
		: {};
	
	return (
		<div
			className="select-none"
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				fontFamily: t.typography.fontFamily,
				fontSize: t.typography.fontSize * zoom,
				fontWeight: t.typography.fontWeight,
				lineHeight: t.typography.lineHeight,
				letterSpacing: t.typography.letterSpacing,
				color: t.typography.color,
				textAlign: t.typography.align,
				opacity: t.opacity ?? 1,
				userSelect: "none",
				WebkitUserSelect: "none",
				MozUserSelect: "none",
				msUserSelect: "none",
				...shadowStyle,
			}}
			onMouseDown={(e: React.MouseEvent) => {
				// Prevent text selection
				if (e.detail > 1) {
					e.preventDefault();
				}
			}}
		>
			{t.text}
		</div>
	);
}

interface TextPropertiesProps {
	element: Extract<TemplateElement, { type: "text" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
	allElements?: TemplateElement[];
}

export function TextProperties({ element, onChange, isNarrow }: TextPropertiesProps) {
	const { t: translate } = useTranslation();
	const t = element as Extract<TemplateElement, { type: "text" }>;

	// Keep effect for any future external sync needs
	useEffect(() => {}, [t.binding]);
	
	// Common position/size controls
	const common = (
		<section className={`${components.section} ${separators.subsectionDivider}`}>
			<h4 className={typography.subsectionTitle}>{translate('designer.elementProperties.common.positionAndSize')}</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{translate('designer.elementProperties.common.x')}</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{translate('designer.elementProperties.common.y')}</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{translate('designer.elementProperties.common.width')}</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{translate('designer.elementProperties.common.height')}</Label>
					<Input
						type="number"
						value={element.height}
						onChange={(e) => onChange({ height: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
			</div>
		</section>
	);

	return (
		<div className={components.section}>
			<h3 className={typography.sectionTitle}>{translate('designer.elementProperties.text.title')}</h3>
			
			{/* Content */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{translate('designer.elementProperties.text.content')}</h4>
				<div className={components.subsection}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.text')}</Label>
						<Input
							value={t.text ?? ""}
							onChange={(e) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: e.target.value,
									binding: t.binding,
									typography: t.typography,
									format: t.format,
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.binding.dataBinding')}</Label>
						<FieldCombobox
							value={t.binding}
							fieldId={t.fieldId}
							onSelect={(fieldId, binding) => {
								onChange({
									...element,
									binding: binding || undefined,
									fieldId,
									isCustomBinding: false,
								});
							}}
							onCustomBinding={(binding) => {
								onChange({
									...element,
									binding,
									fieldId: undefined,
									isCustomBinding: true,
								});
							}}
						/>
					</div>
				</div>
			</section>
			{/* Typography */}
			<section className={`${components.subsection} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>{translate('designer.elementProperties.text.typography')}</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<GoogleFontPicker
							value={t.typography.fontFamily}
							onChange={(fontFamily) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: t.text,
									binding: t.binding,
									typography: { ...t.typography, fontFamily },
									format: t.format,
								})
							}
							label={translate('designer.elementProperties.text.fontFamily', 'Font Family')}
							title={translate('designer.elementProperties.text.fontFamilyDialogTitle', 'Choose Text Font')}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.fontSize')}</Label>
						<Input
							type="number"
							value={t.typography.fontSize}
							onChange={(e) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: t.text,
									binding: t.binding,
									typography: { ...t.typography, fontSize: Number(e.target.value) },
									format: t.format,
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.weight')}</Label>
						<Select
							value={t.typography.fontWeight}
							onValueChange={(v) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: t.text,
									binding: t.binding,
									typography: { ...t.typography, fontWeight: v as typeof t.typography.fontWeight },
									format: t.format,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="normal">{translate('designer.elementProperties.text.fontWeights.normal')}</SelectItem>
								<SelectItem value="medium">{translate('designer.elementProperties.text.fontWeights.medium')}</SelectItem>
								<SelectItem value="semibold">{translate('designer.elementProperties.text.fontWeights.semibold')}</SelectItem>
								<SelectItem value="bold">{translate('designer.elementProperties.text.fontWeights.bold')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
						<div className={components.field}>
							<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.color')}</Label>
							<ColorPicker
								value={t.typography.color || "#111827"}
								onChange={(color) =>
									onChange({
										id: element.id,
										type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
										zIndex: element.zIndex,
										visible: element.visible,
										text: t.text,
										binding: t.binding,
										typography: { ...t.typography, color },
										format: t.format,
									})
								}
							/>
						</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.alignment')}</Label>
						<Select
							value={t.typography.align}
							onValueChange={(v) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: t.text,
									binding: t.binding,
									typography: { ...t.typography, align: v as typeof t.typography.align },
									format: t.format,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="left">{translate('designer.elementProperties.text.alignments.left')}</SelectItem>
								<SelectItem value="center">{translate('designer.elementProperties.text.alignments.center')}</SelectItem>
								<SelectItem value="right">{translate('designer.elementProperties.text.alignments.right')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.uppercase')}</Label>
						<div className="flex items-center h-9">
							<Switch
								checked={t.typography.uppercase}
								onCheckedChange={(checked) =>
									onChange({
										id: element.id,
										type: "text",
										x: element.x,
										y: element.y,
										width: element.width,
										height: element.height,
										rotation: element.rotation,
										zIndex: element.zIndex,
										visible: element.visible,
										text: t.text,
										binding: t.binding,
										typography: { ...t.typography, uppercase: checked, lowercase: checked ? false : t.typography.lowercase },
										format: t.format,
									})
								}
							/>
						</div>
					</div>
				</div>
			</section>
			
			{/* Enhanced Styling Section */}
			<section className={`${components.subsection} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>{translate('designer.elementProperties.text.styling')}</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.backgroundColor')}</Label>
						<ColorPicker
							value={t.backgroundColor || "#ffffff"}
							onChange={(color) =>
								onChange({
									...element,
									backgroundColor: color.trim().length === 0 ? undefined : color,
								})
							}
							allowTransparent
							transparentLabel={translate("designer.elementProperties.text.transparent", "Transparent")}
						/>
					</div>
					
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.opacity')}</Label>
						<div className="flex gap-2 items-center">
							<Input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={t.opacity ?? 1}
								onChange={(e) => {
									onChange({
										...element,
										opacity: Number(e.target.value),
									});
								}}
								className="flex-1"
							/>
							<span className={`${typography.helperText} w-10 text-right`}>
								{Math.round((t.opacity ?? 1) * 100)}%
							</span>
						</div>
					</div>
				</div>
				
				{/* Shadow Controls */}
				<div className={`${components.card} ${spacing.fieldGroupGap}`}>
					<div className="flex items-center justify-between">
						<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.shadow')}</Label>
						<Switch
							checked={t.shadow?.enabled || false}
								onCheckedChange={(checked) => {
									onChange({
										...element,
										shadow: checked
											? {
													enabled: true,
													blur: 4,
													offsetX: 0,
													offsetY: 2,
													spread: 0,
													color: "#00000040",
												}
											: undefined,
									});
								}}
						/>
					</div>
					
					{t.shadow?.enabled && (
						<div className={components.grid}>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.blur')}</Label>
								<Input
									type="number"
									min="0"
									max="20"
									value={t.shadow.blur}
									onChange={(e) => {
										onChange({
											...element,
											shadow: {
												...t.shadow!,
												blur: Number(e.target.value),
											},
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.offsetY')}</Label>
								<Input
									type="number"
									min="-10"
									max="10"
									value={t.shadow.offsetY}
									onChange={(e) => {
										onChange({
											...element,
											shadow: {
												...t.shadow!,
												offsetY: Number(e.target.value),
											},
										});
									}}
									className={components.inputHeight}
								/>
							</div>
								<div className={components.field}>
									<Label className={typography.fieldLabel}>{translate('designer.elementProperties.text.shadowColor')}</Label>
									<ColorPicker
										value={t.shadow.color || "#00000040"}
										onChange={(color) => {
											onChange({
												...element,
												shadow: {
													...t.shadow!,
													color,
												},
											});
										}}
									/>
								</div>
							</div>
						)}
				</div>
			</section>
			
			{common}
		</div>
	);
}

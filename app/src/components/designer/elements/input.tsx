import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";
import { FormulaBuilder } from "../formula-builder";
import { typography, separators, components } from "../design-system";
import { GoogleFontPicker } from "@/components/designer/google-font-picker";
import { FieldCombobox } from "@/components/designer/field-combobox";
import { getCatalogField } from "@/core/entities/field-catalog";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { getDesignerDefaultValueForBinding } from "@/utils/designer-binding-defaults";

interface InputElementProps {
	element: Extract<TemplateElement, { type: "input" }>;
}

export default function InputElement({ element }: InputElementProps) {
	const inp = element;

	return (
		<div className="w-full h-full">
			<input
				type={inp.variant}
				placeholder={inp.placeholder}
				className="w-full h-full border border-border rounded px-2 text-[10px] bg-background text-foreground placeholder:text-muted-foreground"
				style={{
					textAlign: inp.align as React.CSSProperties["textAlign"],
					fontFamily: inp.fontFamily || "Inter",
				}}
				readOnly
				tabIndex={-1}
				onFocus={(e) => e.target.blur()}
			/>
		</div>
	);
}

interface InputPropertiesProps {
	element: Extract<TemplateElement, { type: "input" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
	allElements?: TemplateElement[];
}

export function InputProperties({ element, onChange, isNarrow, allElements = [] }: InputPropertiesProps) {
	const { t } = useTranslation();
	const { data: currentOrganization } = useCurrentOrganization();
	const inp = element;
	
	// Common position/size controls
	const common = (
		<section className={`${components.section} ${separators.subsectionDivider}`}>
			<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.common.positionAndSize')}</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.x')}</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.y')}</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.width')}</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.height')}</Label>
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
			<h3 className={typography.sectionTitle}>{t('designer.elementProperties.input.title')}</h3>
			
			{/* Input Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.input.settings')}</h4>
				<div className={components.grid}>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.input.placeholder')}</Label>
						<Input
							placeholder={t('designer.elementProperties.input.placeholder')}
							value={inp.placeholder}
							onChange={(e) =>
								onChange({
									id: element.id,
									type: "input",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									placeholder: e.target.value,
									variant: inp.variant,
									align: inp.align,
									fontFamily: inp.fontFamily,
									binding: inp.binding,
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.input.variant')}</Label>
						<Select
							value={inp.variant}
							onValueChange={(v) =>
								onChange({
									id: element.id,
									type: "input",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									placeholder: inp.placeholder,
									variant: v as typeof inp.variant,
									align: inp.align,
									fontFamily: inp.fontFamily,
									binding: inp.binding,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="text">{t('designer.elementProperties.input.variants.text')}</SelectItem>
								<SelectItem value="number">{t('designer.elementProperties.input.variants.number')}</SelectItem>
								<SelectItem value="date">{t('designer.elementProperties.input.variants.date')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.input.align')}</Label>
						<Select
							value={inp.align}
							onValueChange={(v) =>
								onChange({
									id: element.id,
									type: "input",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									placeholder: inp.placeholder,
									variant: inp.variant,
									align: v as typeof inp.align,
									fontFamily: inp.fontFamily,
									binding: inp.binding,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="left">{t('designer.elementProperties.input.alignments.left')}</SelectItem>
								<SelectItem value="center">{t('designer.elementProperties.input.alignments.center')}</SelectItem>
								<SelectItem value="right">{t('designer.elementProperties.input.alignments.right')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<GoogleFontPicker
							value={inp.fontFamily}
							onChange={(fontFamily) =>
								onChange({
									id: element.id,
									type: "input",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									placeholder: inp.placeholder,
									variant: inp.variant,
									align: inp.align,
									fontFamily,
									binding: inp.binding,
								})
							}
							label={t("designer.elementProperties.input.fontFamily", "Font Family")}
							title={t("designer.elementProperties.input.fontFamilyDialogTitle", "Choose Input Font")}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.binding.dataBinding')}</Label>
						<FieldCombobox
							value={inp.binding}
							fieldId={inp.fieldId}
							onSelect={(fieldId, binding) => {
								const field = getCatalogField(fieldId);
								const defaultValue = getDesignerDefaultValueForBinding(
									binding || fieldId,
									currentOrganization ?? undefined,
								);
								const variant =
									field?.format === "date"
										? "date"
										: field?.format === "number"
											? "number"
											: "text";
								onChange({
									...element,
									binding: binding || undefined,
									fieldId,
									isCustomBinding: false,
									variant,
									placeholder: defaultValue ?? element.placeholder,
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

			{/* Formula Builder for Number Variant */}
			{inp.variant === "number" && (
				<section className={`${components.subsection} ${separators.subsectionDivider}`}>
					<FormulaBuilder
						formula={inp.formula}
						onChange={(formula) =>
							onChange({
								...element,
								formula,
							})
						}
						currentElement={element}
						allElements={allElements}
					/>
				</section>
			)}

			{common}
		</div>
	);
}

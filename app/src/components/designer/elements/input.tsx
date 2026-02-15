import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";
import { AlertCircle, Check } from "lucide-react";
import { FormulaBuilder } from "../formula-builder";
import { typography, spacing, separators, components, colors } from "../design-system";
import { GoogleFontPicker } from "@/components/designer/google-font-picker";
interface InputElementProps {
	element: Extract<TemplateElement, { type: "input" }>;
}

export default function InputElement({ element }: InputElementProps) {
	const inp = element;
	
	return (
		<div className="w-full h-full grid place-items-center text-muted-foreground">
			<input
				type={inp.variant}
				placeholder={inp.placeholder}
				className="w-[95%] h-[80%] border border-border rounded px-2 text-[10px] bg-background text-foreground placeholder:text-muted-foreground"
				style={{
					textAlign: inp.align as React.CSSProperties["textAlign"],
					fontFamily: inp.fontFamily || "Inter",
				}}
				readOnly
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
	const inp = element;
	const [bindingInput, setBindingInput] = useState(inp.binding ?? "");
	
	// Check for duplicate bindings
	const hasDuplicateBinding = (binding: string | undefined): boolean => {
		if (!binding) return false;
		return allElements.some((el) => {
			if (el.id === element.id) return false; // Don't check against self
			if (el.type === "text" || el.type === "input" || el.type === "image") {
				return el.binding === binding;
			}
			if (el.type === "table") {
				return el.itemsBinding === binding;
			}
			return false;
		});
	};
	
	// Generate a unique binding suggestion
	const getUniqueBinding = (binding: string): string => {
		if (!binding) return "";
		let counter = 1;
		let suggested = binding;
		while (hasDuplicateBinding(suggested)) {
			suggested = `${binding} (${counter})`;
			counter++;
		}
		return suggested;
	};
	
	const bindingError = hasDuplicateBinding(bindingInput);
	const suggestedBinding = bindingError ? getUniqueBinding(bindingInput) : null;
	
	// Sync with element binding when it changes externally
	useEffect(() => {
		setBindingInput(inp.binding ?? "");
	}, [inp.binding]);
	
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
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.binding.dataBinding')}</Label>
						<div className={spacing.fieldGroupGap}>
							<Input
								placeholder={t('designer.elementProperties.binding.bindingPlaceholder')}
								value={bindingInput}
								className={`${components.inputHeight} ${bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
								onChange={(e) => {
									const newValue = e.target.value;
									setBindingInput(newValue);
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
										fontFamily: inp.fontFamily,
										binding: newValue || undefined,
									});
								}}
							/>
							{bindingError && suggestedBinding && (
								<div className={`flex items-start gap-2 p-2.5 ${colors.bgWarning} border ${colors.borderDefault} rounded-md`}>
									<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className={`${typography.errorText} mb-1.5`}>
											{t('designer.elementProperties.binding.duplicateError')}
										</p>
										<div className="flex items-center gap-2">
											<p className={`${typography.errorTextSecondary} flex-1 truncate`}>
												{t('designer.elementProperties.binding.suggested')} <span className="font-mono font-medium">{suggestedBinding}</span>
											</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2.5 text-xs border-amber-300 dark:border-amber-700 bg-background hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
												onClick={() => {
													setBindingInput(suggestedBinding);
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
														fontFamily: inp.fontFamily,
														binding: suggestedBinding,
													});
												}}
											>
												<Check className="h-3 w-3 mr-1" />
												{t('designer.elementProperties.binding.use')}
											</Button>
										</div>
									</div>
								</div>
							)}
						</div>
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

import { useState, useEffect } from "react";
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
interface InputElementProps {
	element: Extract<TemplateElement, { type: "input" }>;
}

export default function InputElement({ element }: InputElementProps) {
	const inp = element;
	
	return (
		<div className="w-full h-full grid place-items-center text-neutral-400">
			<input
				type={inp.variant}
				placeholder={inp.placeholder}
				className="w-[95%] h-[80%] border border-neutral-200 rounded px-2 text-[10px] bg-white"
				style={{ textAlign: inp.align as React.CSSProperties["textAlign"] }}
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
			<h4 className={typography.subsectionTitle}>Position & Size</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>X</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Y</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Width</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Height</Label>
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
			<h3 className={typography.sectionTitle}>Input</h3>
			
			{/* Input Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Settings</h4>
				<div className={components.grid}>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>Placeholder</Label>
						<Input
							placeholder="Placeholder"
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
									binding: inp.binding,
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Variant</Label>
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
									binding: inp.binding,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="text">Text</SelectItem>
								<SelectItem value="number">Number</SelectItem>
								<SelectItem value="date">Date</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Align</Label>
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
									binding: inp.binding,
								})
							}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="left">Left</SelectItem>
								<SelectItem value="center">Center</SelectItem>
								<SelectItem value="right">Right</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>Data Binding</Label>
						<div className={spacing.fieldGroupGap}>
							<Input
								placeholder="e.g., invoice.customerName"
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
										binding: newValue || undefined,
									});
								}}
							/>
							{bindingError && suggestedBinding && (
								<div className={`flex items-start gap-2 p-2.5 ${colors.bgWarning} border ${colors.borderDefault} rounded-md`}>
									<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className={`${typography.errorText} mb-1.5`}>
											This binding is already used by another element
										</p>
										<div className="flex items-center gap-2">
											<p className={`${typography.errorTextSecondary} flex-1 truncate`}>
												Suggested: <span className="font-mono font-medium">{suggestedBinding}</span>
											</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2.5 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
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
														binding: suggestedBinding,
													});
												}}
											>
												<Check className="h-3 w-3 mr-1" />
												Use
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

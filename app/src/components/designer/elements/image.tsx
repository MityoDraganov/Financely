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
import { typography, spacing, separators, components, colors } from "../design-system";

interface ImageElementProps {
	element: Extract<TemplateElement, { type: "image" }>;
}

export default function ImageElement({ element }: ImageElementProps) {
	const img = element;
	
	return img.src ? (
		<img
			src={img.src}
			alt={img.alt ?? ""}
			style={{ width: "100%", height: "100%", objectFit: img.objectFit }}
		/>
	) : (
		<div className="w-full h-full bg-neutral-100 grid place-items-center text-neutral-400">
			Image
		</div>
	);
}

interface ImagePropertiesProps {
	element: Extract<TemplateElement, { type: "image" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
	allElements?: TemplateElement[];
}

export function ImageProperties({ element, onChange, isNarrow, allElements = [] }: ImagePropertiesProps) {
	const [bindingInput, setBindingInput] = useState(element.binding ?? "");
	
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
		setBindingInput(element.binding ?? "");
	}, [element.binding]);
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
			<h3 className={typography.sectionTitle}>Image</h3>
			
			{/* Image Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Settings</h4>
				<div className={components.grid}>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>Image URL (Default)</Label>
						<Input
							placeholder="https://..."
							value={element.src}
							onChange={(e) => {
								const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, src: e.target.value });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>Data Binding (Optional)</Label>
						<div className={spacing.fieldGroupGap}>
							<Input
								placeholder="e.g., company.logoUrl"
								value={bindingInput}
								className={`${components.inputHeight} ${bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
								onChange={(e) => {
									const newValue = e.target.value;
									setBindingInput(newValue);
									const img = element as Extract<TemplateElement, { type: "image" }>;
									onChange({ ...img, binding: newValue || undefined });
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
													const img = element as Extract<TemplateElement, { type: "image" }>;
													onChange({ ...img, binding: suggestedBinding });
												}}
											>
												<Check className="h-3 w-3 mr-1" />
												Use
											</Button>
										</div>
									</div>
								</div>
							)}
							<p className={typography.helperText}>
								Leave empty to use default URL. Set a binding to override with data from invoice.
							</p>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Object Fit</Label>
						<Select
							value={element.objectFit}
							onValueChange={(v) => {
								const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, objectFit: v as Extract<TemplateElement, { type: "image" }>["objectFit"] });
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="contain">Contain</SelectItem>
								<SelectItem value="cover">Cover</SelectItem>
								<SelectItem value="fill">Fill</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>
			
			{common}
		</div>
	);
}

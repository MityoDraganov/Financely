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
		<div className={isNarrow ? "grid grid-cols-1 gap-2" : "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2"}>
			<div className="space-y-1">
				<Label className="text-xs">X</Label>
				<Input
					type="number"
					value={element.x}
					onChange={(e) => onChange({ x: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Y</Label>
				<Input
					type="number"
					value={element.y}
					onChange={(e) => onChange({ y: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Width</Label>
				<Input
					type="number"
					value={element.width}
					onChange={(e) => onChange({ width: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Height</Label>
				<Input
					type="number"
					value={element.height}
					onChange={(e) => onChange({ height: Number(e.target.value) })}
				/>
			</div>
		</div>
	);

	return (
		<div className="space-y-2">
			<div className="text-xs font-medium">Image</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Image URL (Default)</Label>
					<Input
						placeholder="https://..."
						value={element.src}
						onChange={(e) => {
							const img = element as Extract<TemplateElement, { type: "image" }>;
							onChange({ ...img, src: e.target.value });
						}}
					/>
				</div>
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Data Binding (Optional)</Label>
					<div className="space-y-1.5">
					<Input
						placeholder="e.g., company.logoUrl"
							value={bindingInput}
							className={bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}
						onChange={(e) => {
								const newValue = e.target.value;
								setBindingInput(newValue);
								// Update immediately, but show warning if duplicate
							const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, binding: newValue || undefined });
							}}
						/>
						{bindingError && suggestedBinding && (
							<div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
								<AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium text-amber-800 mb-1">
										This binding is already used by another element
									</p>
									<div className="flex items-center gap-2">
										<p className="text-xs text-amber-700 flex-1 truncate">
											Suggested: <span className="font-mono font-medium">{suggestedBinding}</span>
										</p>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-6 px-2 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
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
					<div className="text-xs text-muted-foreground">
						Leave empty to use default URL. Set a binding to override with data from invoice.
						</div>
					</div>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Object fit</Label>
					<Select
						value={element.objectFit}
						onValueChange={(v) => {
							const img = element as Extract<TemplateElement, { type: "image" }>;
							onChange({ ...img, objectFit: v as Extract<TemplateElement, { type: "image" }>["objectFit"] });
						}}
					>
						<SelectTrigger>
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
			{common}
		</div>
	);
}

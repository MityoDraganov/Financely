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
			<div className="text-xs font-medium">Input</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Placeholder</Label>
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
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Variant</Label>
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
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="text">Text</SelectItem>
							<SelectItem value="number">Number</SelectItem>
							<SelectItem value="date">Date</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Align</Label>
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
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="left">Left</SelectItem>
							<SelectItem value="center">Center</SelectItem>
							<SelectItem value="right">Right</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Binding</Label>
					<div className="space-y-1.5">
					<Input
						placeholder="invoice.customerName"
							value={bindingInput}
							className={bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}
							onChange={(e) => {
								const newValue = e.target.value;
								setBindingInput(newValue);
								// Update immediately, but show warning if duplicate
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
			{common}
		</div>
	);
}

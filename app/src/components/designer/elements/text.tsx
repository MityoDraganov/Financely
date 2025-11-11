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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TemplateElement } from "@/core";
import { AlertCircle, Check } from "lucide-react";

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
			style={{
				fontFamily: t.typography.fontFamily,
				fontSize: t.typography.fontSize * zoom,
				fontWeight: t.typography.fontWeight,
				lineHeight: t.typography.lineHeight,
				letterSpacing: t.typography.letterSpacing,
				color: t.typography.color,
				textAlign: t.typography.align,
				backgroundColor: t.backgroundColor || "transparent",
				padding: `${(t.padding || 0) * zoom}px`,
				opacity: t.opacity ?? 1,
				...shadowStyle,
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

export function TextProperties({ element, onChange, isNarrow, allElements = [] }: TextPropertiesProps) {
	const t = element as Extract<TemplateElement, { type: "text" }>;
	const [bindingInput, setBindingInput] = useState(t.binding ?? "");
	
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
		setBindingInput(t.binding ?? "");
	}, [t.binding]);
	
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
			<div className="text-xs font-medium">Text</div>
			<div className="space-y-1">
				<Label className="text-xs">Text</Label>
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
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Data Binding</Label>
				<div className="space-y-1.5">
				<Input
					placeholder="e.g., invoice.customerName"
						value={bindingInput}
						className={bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}
						onChange={(e) => {
							const newValue = e.target.value;
							setBindingInput(newValue);
							// Update immediately, but show warning if duplicate
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
								binding: newValue || undefined,
							typography: t.typography,
							format: t.format,
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
												type: "text",
												x: element.x,
												y: element.y,
												width: element.width,
												height: element.height,
												rotation: element.rotation,
												zIndex: element.zIndex,
												visible: element.visible,
												text: t.text,
												binding: suggestedBinding,
												typography: t.typography,
												format: t.format,
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
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1">
					<Label className="text-xs">Font size</Label>
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
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Weight</Label>
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
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="normal">Normal</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="semibold">Semibold</SelectItem>
							<SelectItem value="bold">Bold</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Color</Label>
					<Input
						placeholder="#111827"
						value={t.typography.color}
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
								typography: { ...t.typography, color: e.target.value },
								format: t.format,
							})
						}
					/>
				</div>
			</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1">
					<Label className="text-xs">Alignment</Label>
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
				<div className="space-y-1">
					<Label className="text-xs">Uppercase</Label>
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
			
			<Separator className="my-3" />
			
			{/* Enhanced Styling Section */}
			<div className="space-y-3">
				<div className="text-xs font-semibold text-neutral-600">Enhanced Styling</div>
				
				<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
					<div className="space-y-1">
						<Label className="text-xs">Background Color</Label>
						<div className="flex gap-2">
							<Input
								type="color"
								value={t.backgroundColor || "#ffffff"}
								onChange={(e) => {
									const newBg = e.target.value === "#ffffff" ? undefined : e.target.value;
									onChange({
										...element,
										backgroundColor: newBg,
									});
								}}
								className="w-12 h-9 p-1 cursor-pointer"
							/>
							<Input
								placeholder="#ffffff or transparent"
								value={t.backgroundColor || ""}
								onChange={(e) => {
									const newBg = e.target.value || undefined;
									onChange({
										...element,
										backgroundColor: newBg,
									});
								}}
							/>
						</div>
					</div>
					
					<div className="space-y-1">
						<Label className="text-xs">Padding (px)</Label>
						<Input
							type="number"
							min="0"
							max="50"
							value={t.padding || 0}
							onChange={(e) => {
								onChange({
									...element,
									padding: Number(e.target.value) || 0,
								});
							}}
						/>
					</div>
					
					<div className="space-y-1">
						<Label className="text-xs">Opacity</Label>
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
							<span className="text-xs w-10 text-right">
								{Math.round((t.opacity ?? 1) * 100)}%
							</span>
						</div>
					</div>
				</div>
				
				{/* Shadow Controls */}
				<div className="space-y-2 p-3 bg-neutral-50 rounded-md border">
					<div className="flex items-center justify-between">
						<Label className="text-xs">Shadow</Label>
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
												color: "#00000040",
											}
										: undefined,
								});
							}}
						/>
					</div>
					
					{t.shadow?.enabled && (
						<div className="grid grid-cols-2 gap-2 mt-2">
							<div className="space-y-1">
								<Label className="text-xs">Blur</Label>
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
								/>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Offset Y</Label>
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
								/>
							</div>
							<div className="space-y-1">
								<Label className="text-xs">Shadow Color</Label>
								<div className="flex gap-2">
									<Input
										type="color"
										value={t.shadow.color || "#000000"}
										onChange={(e) => {
											onChange({
												...element,
												shadow: {
													...t.shadow!,
													color: e.target.value,
												},
											});
										}}
										className="w-12 h-9 p-1 cursor-pointer"
									/>
									<Input
										value={t.shadow.color || "#00000040"}
										onChange={(e) => {
											onChange({
												...element,
												shadow: {
													...t.shadow!,
													color: e.target.value,
												},
											});
										}}
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			
			{common}
		</div>
	);
}

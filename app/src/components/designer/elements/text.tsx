import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TemplateElement } from "@/core";

interface TextElementProps {
	element: Extract<TemplateElement, { type: "text" }>;
	zoom: number;
}

export default function TextElement({ element, zoom }: TextElementProps) {
	const t = element;
	
	return (
		<div
			className="p-1"
			style={{
				fontFamily: t.typography.fontFamily,
				fontSize: t.typography.fontSize * zoom,
				fontWeight: t.typography.fontWeight,
				lineHeight: t.typography.lineHeight,
				letterSpacing: t.typography.letterSpacing,
				color: t.typography.color,
				textAlign: t.typography.align,
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
}

export function TextProperties({ element, onChange, isNarrow }: TextPropertiesProps) {
	const t = element;
	
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
				<Input
					placeholder="e.g., invoice.customerName"
					value={t.binding ?? ""}
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
							binding: e.target.value || undefined,
							typography: t.typography,
							format: t.format,
						})
					}
				/>
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
			{common}
		</div>
	);
}

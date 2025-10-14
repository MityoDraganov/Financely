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
}

export function ImageProperties({ element, onChange, isNarrow }: ImagePropertiesProps) {
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
					<Input
						placeholder="e.g., company.logoUrl"
						value={element.binding || ""}
						onChange={(e) => {
							const img = element as Extract<TemplateElement, { type: "image" }>;
							onChange({ ...img, binding: e.target.value || undefined });
						}}
					/>
					<div className="text-xs text-muted-foreground">
						Leave empty to use default URL. Set a binding to override with data from invoice.
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

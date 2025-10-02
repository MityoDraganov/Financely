import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateElement } from "@/core";

interface BoxElementProps {
	element: Extract<TemplateElement, { type: "box" }>;
}

export default function BoxElement({ element }: BoxElementProps) {
	const b = element;
	
	return (
		<div
			className="w-full h-full"
			style={{
				background: b.fill,
				border: `${b.strokeWidth}px solid ${b.stroke}`,
				borderRadius: b.radius,
			}}
		/>
	);
}

interface BoxPropertiesProps {
	element: Extract<TemplateElement, { type: "box" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function BoxProperties({ element, onChange, isNarrow }: BoxPropertiesProps) {
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
			<div className="text-xs font-medium">Box</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1">
					<Label className="text-xs">Fill</Label>
					<Input
						placeholder="#RRGGBB"
						value={element.fill}
						onChange={(e) => {
							const bx = element as Extract<TemplateElement, { type: "box" }>;
							onChange({ ...bx, fill: e.target.value });
						}}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Stroke</Label>
					<Input
						placeholder="#RRGGBB"
						value={element.stroke}
						onChange={(e) => {
							const bx = element as Extract<TemplateElement, { type: "box" }>;
							onChange({ ...bx, stroke: e.target.value });
						}}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Stroke width</Label>
					<Input
						type="number"
						placeholder="1"
						value={element.strokeWidth}
						onChange={(e) => {
							const bx = element as Extract<TemplateElement, { type: "box" }>;
							onChange({ ...bx, strokeWidth: Number(e.target.value) });
						}}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Corner radius</Label>
					<Input
						type="number"
						placeholder="0"
						value={element.radius}
						onChange={(e) => {
							const bx = element as Extract<TemplateElement, { type: "box" }>;
							onChange({ ...bx, radius: Number(e.target.value) });
						}}
					/>
				</div>
			</div>
			{common}
		</div>
	);
}

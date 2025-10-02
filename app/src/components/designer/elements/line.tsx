import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateElement } from "@/core";

interface LineElementProps {
	element: Extract<TemplateElement, { type: "line" }>;
}

export default function LineElement({ element }: LineElementProps) {
	const ln = element;
	
	return (
		<div
			className="absolute top-1/2 left-0 right-0 border-t"
			style={{
				borderColor: ln.stroke,
				borderWidth: ln.strokeWidth,
			}}
		/>
	);
}

interface LinePropertiesProps {
	element: Extract<TemplateElement, { type: "line" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function LineProperties({ element, onChange, isNarrow }: LinePropertiesProps) {
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
			<div className="text-xs font-medium">Line</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1">
					<Label className="text-xs">Stroke</Label>
					<Input
						placeholder="#RRGGBB"
						value={element.stroke}
						onChange={(e) => {
							const ln = element as Extract<TemplateElement, { type: "line" }>;
							onChange({ ...ln, stroke: e.target.value });
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
							const ln = element as Extract<TemplateElement, { type: "line" }>;
							onChange({ ...ln, strokeWidth: Number(e.target.value) });
						}}
					/>
				</div>
			</div>
			{common}
		</div>
	);
}

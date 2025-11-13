import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateElement } from "@/core";
import { typography, spacing, separators, components } from "../design-system";

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
			<h3 className={typography.sectionTitle}>Line</h3>
			
			{/* Line Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Styling</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke</Label>
						<Input
							placeholder="#RRGGBB"
							value={element.stroke}
							onChange={(e) => {
								const ln = element as Extract<TemplateElement, { type: "line" }>;
								onChange({ ...ln, stroke: e.target.value });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke Width</Label>
						<Input
							type="number"
							placeholder="1"
							value={element.strokeWidth}
							onChange={(e) => {
								const ln = element as Extract<TemplateElement, { type: "line" }>;
								onChange({ ...ln, strokeWidth: Number(e.target.value) });
							}}
							className={components.inputHeight}
						/>
					</div>
				</div>
			</section>
			
			{common}
		</div>
	);
}

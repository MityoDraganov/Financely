import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";
import { typography, spacing, separators, components } from "../design-system";

interface BoxElementProps {
	element: Extract<TemplateElement, { type: "box" }>;
}

export default function BoxElement({ element }: BoxElementProps) {
	const b = element;
	
	// Build gradient background if fillGradient is set
	const background = b.fillGradient
		? b.fillGradient.type === "linear"
			? `linear-gradient(${b.fillGradient.angle}deg, ${b.fillGradient.colors.join(", ")})`
			: `radial-gradient(circle, ${b.fillGradient.colors.join(", ")})`
		: b.fill;
	
	const shadowStyle = b.shadow?.enabled
		? {
				boxShadow: `${b.shadow.offsetX}px ${b.shadow.offsetY}px ${b.shadow.blur}px ${b.shadow.color}`,
			}
		: {};
	
	return (
		<div
			className="w-full h-full"
			style={{
				background,
				border: `${b.strokeWidth}px solid ${b.stroke}`,
				borderRadius: b.radius,
				opacity: b.opacity ?? 1,
				...shadowStyle,
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
			<h3 className={typography.sectionTitle}>Box</h3>
			
			{/* Box Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Styling</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Fill</Label>
						<div className="flex gap-2">
							<Input
								type="color"
								value={element.fill || "#ffffff"}
								onChange={(e) => {
									onChange({ ...element, fill: e.target.value });
								}}
								className={`w-12 ${components.inputHeight} p-1 cursor-pointer`}
							/>
							<Input
								placeholder="#RRGGBB"
								value={element.fill}
								onChange={(e) => {
									onChange({ ...element, fill: e.target.value });
								}}
								className={components.inputHeight}
							/>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke</Label>
						<div className="flex gap-2">
							<Input
								type="color"
								value={element.stroke || "#e5e7eb"}
								onChange={(e) => {
									onChange({ ...element, stroke: e.target.value });
								}}
								className={`w-12 ${components.inputHeight} p-1 cursor-pointer`}
							/>
							<Input
								placeholder="#RRGGBB"
								value={element.stroke}
								onChange={(e) => {
									onChange({ ...element, stroke: e.target.value });
								}}
								className={components.inputHeight}
							/>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke Width</Label>
						<Input
							type="number"
							placeholder="1"
							value={element.strokeWidth}
							onChange={(e) => {
								onChange({ ...element, strokeWidth: Number(e.target.value) });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Corner Radius</Label>
						<Input
							type="number"
							placeholder="0"
							value={element.radius}
							onChange={(e) => {
								onChange({ ...element, radius: Number(e.target.value) });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Opacity</Label>
						<div className="flex gap-2 items-center">
							<Input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={element.opacity ?? 1}
								onChange={(e) => {
									onChange({ ...element, opacity: Number(e.target.value) });
								}}
								className="flex-1"
							/>
							<span className={`${typography.helperText} w-10 text-right`}>
								{Math.round((element.opacity ?? 1) * 100)}%
							</span>
						</div>
					</div>
				</div>
				
				{/* Gradient Controls */}
				<div className={`${components.card} ${spacing.fieldGroupGap}`}>
					<div className="flex items-center justify-between">
						<Label className={typography.fieldLabel}>Gradient Fill</Label>
						<Switch
							checked={!!element.fillGradient}
							onCheckedChange={(checked) => {
								onChange({
									...element,
									fillGradient: checked
										? {
												type: "linear",
												colors: ["#ffffff", "#f3f4f6"],
												angle: 90,
											}
										: undefined,
								});
							}}
						/>
					</div>
					
					{element.fillGradient && (
						<div className={spacing.fieldGroupGap}>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Gradient Type</Label>
								<Select
									value={element.fillGradient.type}
									onValueChange={(v) => {
										onChange({
											...element,
											fillGradient: {
												...element.fillGradient!,
												type: v as "linear" | "radial",
											},
										});
									}}
								>
									<SelectTrigger className={components.inputHeight}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="linear">Linear</SelectItem>
										<SelectItem value="radial">Radial</SelectItem>
									</SelectContent>
								</Select>
							</div>
							
							{element.fillGradient.type === "linear" && (
								<div className={components.field}>
									<Label className={typography.fieldLabel}>Angle (degrees)</Label>
									<Input
										type="number"
										min="0"
										max="360"
										value={element.fillGradient.angle}
										onChange={(e) => {
											onChange({
												...element,
												fillGradient: {
													...element.fillGradient!,
													angle: Number(e.target.value),
												},
											});
										}}
										className={components.inputHeight}
									/>
								</div>
							)}
							
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Colors (2-4 colors)</Label>
								<div className={spacing.fieldGroupGap}>
									{element.fillGradient.colors.map((color, idx) => (
										<div key={idx} className="flex gap-2">
											<Input
												type="color"
												value={color}
												onChange={(e) => {
													const newColors = [...element.fillGradient!.colors];
													newColors[idx] = e.target.value;
													onChange({
														...element,
														fillGradient: {
															...element.fillGradient!,
															colors: newColors,
														},
													});
												}}
												className={`w-12 ${components.inputHeight} p-1 cursor-pointer`}
											/>
											<Input
												value={color}
												onChange={(e) => {
													const newColors = [...element.fillGradient!.colors];
													newColors[idx] = e.target.value;
													onChange({
														...element,
														fillGradient: {
															...element.fillGradient!,
															colors: newColors,
														},
													});
												}}
												className={components.inputHeight}
											/>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
				
				{/* Shadow Controls */}
				<div className={`${components.card} ${spacing.fieldGroupGap}`}>
					<div className="flex items-center justify-between">
						<Label className={typography.fieldLabel}>Shadow</Label>
						<Switch
							checked={element.shadow?.enabled || false}
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
					
					{element.shadow?.enabled && (
						<div className={components.grid}>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Blur</Label>
								<Input
									type="number"
									min="0"
									max="20"
									value={element.shadow.blur}
									onChange={(e) => {
										onChange({
											...element,
											shadow: {
												...element.shadow!,
												blur: Number(e.target.value),
											},
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Offset Y</Label>
								<Input
									type="number"
									min="-10"
									max="10"
									value={element.shadow.offsetY}
									onChange={(e) => {
										onChange({
											...element,
											shadow: {
												...element.shadow!,
												offsetY: Number(e.target.value),
											},
										});
									}}
									className={components.inputHeight}
								/>
							</div>
							<div className={components.field}>
								<Label className={typography.fieldLabel}>Shadow Color</Label>
								<div className="flex gap-2">
									<Input
										type="color"
										value={element.shadow.color || "#000000"}
										onChange={(e) => {
											onChange({
												...element,
												shadow: {
													...element.shadow!,
													color: e.target.value,
												},
											});
										}}
										className={`w-12 ${components.inputHeight} p-1 cursor-pointer`}
									/>
									<Input
										value={element.shadow.color || "#00000040"}
										onChange={(e) => {
											onChange({
												...element,
												shadow: {
													...element.shadow!,
													color: e.target.value,
												},
											});
										}}
										className={components.inputHeight}
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</section>
			
			{common}
		</div>
	);
}

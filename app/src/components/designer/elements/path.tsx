import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";
import { typography, spacing, separators, components } from "../design-system";
import { usePathEditing } from "../path-editor/path-editing-context";

interface PathElementProps {
	element: Extract<TemplateElement, { type: "path" }>;
}

export default function PathElement({ element }: PathElementProps) {
	const p = element;

	// Build gradient fill if fillGradient is set
	const fill = p.fillGradient
		? p.fillGradient.type === "linear"
			? `url(#gradient-${p.id})`
			: `url(#gradient-${p.id})`
		: p.fill;

	const shadowStyle = p.shadow?.enabled
		? `drop-shadow(${p.shadow.offsetX}px ${p.shadow.offsetY}px ${p.shadow.blur}px ${p.shadow.color})`
		: undefined;

	// Calculate stroke dasharray for dashed/dotted strokes
	const strokeDasharray = p.strokeStyle === "dashed"
		? `${(p.strokeWidth || 1) * 4},${(p.strokeWidth || 1) * 2}`
		: p.strokeStyle === "dotted"
		? `${p.strokeWidth || 1},${(p.strokeWidth || 1) * 2}`
		: undefined;

	return (
		<svg
			className="w-full h-full"
			viewBox={`0 0 ${p.width} ${p.height}`}
			preserveAspectRatio="none"
			xmlns="http://www.w3.org/2000/svg"
			style={{
				opacity: p.opacity ?? 1,
				mixBlendMode: p.blendMode || "normal",
				filter: shadowStyle,
			}}
		>
			{/* Define gradients if needed */}
			{p.fillGradient && (
				<defs>
					{p.fillGradient.type === "linear" ? (
						<linearGradient id={`gradient-${p.id}`} gradientTransform={`rotate(${p.fillGradient.angle})`}>
							{p.fillGradient.colors.map((color, idx) => (
								<stop
									key={idx}
									offset={`${(idx / (p.fillGradient!.colors.length - 1)) * 100}%`}
									stopColor={color}
								/>
							))}
						</linearGradient>
					) : (
						<radialGradient id={`gradient-${p.id}`}>
							{p.fillGradient.colors.map((color, idx) => (
								<stop
									key={idx}
									offset={`${(idx / (p.fillGradient!.colors.length - 1)) * 100}%`}
									stopColor={color}
								/>
							))}
						</radialGradient>
					)}
				</defs>
			)}

			<path
				d={p.pathData}
				fill={fill}
				fillRule={p.fillRule || "nonzero"}
				stroke={p.stroke}
				strokeWidth={p.strokeWidth || 0}
				strokeLinecap={p.strokeLinecap || "butt"}
				strokeLinejoin={p.strokeLinejoin || "miter"}
				strokeDasharray={strokeDasharray}
			/>
		</svg>
	);
}

interface PathPropertiesProps {
	element: Extract<TemplateElement, { type: "path" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function PathProperties({
	element,
	onChange,
	isNarrow,
}: PathPropertiesProps) {
	const { t } = useTranslation();
	const path = usePathEditing();
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const lastValidPathDataRef = useRef(element.pathData);
	const isPathEditing = path.editingPathElementId === element.id;
	const activeSubpath = isPathEditing ? path.activeSubpath : undefined;

	useEffect(() => {
		lastValidPathDataRef.current = element.pathData;
	}, [element.pathData]);

	// Common position/size controls
	const common = (
		<section className={`${components.section} ${separators.subsectionDivider}`}>
			<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.common.positionAndSize')}</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.x')}</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.y')}</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.width')}</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.height')}</Label>
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
			<h3 className={typography.sectionTitle}>SVG Path</h3>

			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Path</h4>
				<div className={`${components.card} ${spacing.fieldGroupGap}`}>
					<div className="flex items-center justify-between">
						<Label className={typography.fieldLabel}>Closed</Label>
						<Switch
							checked={Boolean(activeSubpath?.closed)}
							disabled={!isPathEditing || !activeSubpath}
							onCheckedChange={(checked) => path.toggleActiveSubpathClosed(checked)}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Subpaths</Label>
						<div className="space-y-1">
							{(element.subpaths ?? []).map((subpath, index) => {
								const selected = activeSubpath?.id === subpath.id;
								return (
									<Button
										key={subpath.id}
										type="button"
										variant={selected ? "secondary" : "ghost"}
										size="sm"
										className="h-8 w-full justify-between text-xs"
										onClick={() => path.selectSubpath({ elementId: element.id, subpathId: subpath.id })}
									>
										<span>Subpath {index + 1}</span>
										<span className="text-muted-foreground">{subpath.closed ? "Closed" : "Open"}</span>
									</Button>
								);
							})}
						</div>
					</div>
					<div className={typography.helperText}>
						{isPathEditing
							? "Use the floating vector toolbar on canvas for node tools."
							: "Select Edit Path on canvas to enter vector mode."}
					</div>
				</div>

				<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
					<CollapsibleTrigger asChild>
						<Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-xs">
							Advanced SVG Data
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="pt-2 space-y-2">
						<div className={components.field}>
							<Label className={typography.fieldLabel}>
								SVG Path (d attribute)
								<span className={`${typography.helperText} ml-2`}>Cubic path commands</span>
							</Label>
							<Textarea
								value={element.pathData}
								onChange={(e) => onChange({ pathData: e.target.value })}
								placeholder="M 10,10 C 20,20 40,20 60,10 Z"
								className="font-mono text-xs"
								rows={4}
							/>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={async () => {
									try {
										await navigator.clipboard.writeText(element.pathData);
									} catch {
										// Ignore clipboard errors.
									}
								}}
							>
								Copy
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={async () => {
									try {
										const text = await navigator.clipboard.readText();
										if (text.trim().length > 0) onChange({ pathData: text });
									} catch {
										// Ignore clipboard errors.
									}
								}}
							>
								Paste
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onChange({ pathData: lastValidPathDataRef.current })}
							>
								Reset
							</Button>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</section>

			{/* Fill Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Fill</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Fill Color</Label>
						<ColorPicker
							value={element.fill || "#3b82f6"}
							onChange={(color) =>
								onChange({
									...element,
									fill: color.trim().length === 0 ? undefined : color,
								})
							}
							allowTransparent
							transparentLabel="None"
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Fill Rule</Label>
						<Select
							value={element.fillRule || "nonzero"}
							onValueChange={(v) => onChange({ fillRule: v as "nonzero" | "evenodd" })}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="nonzero">Non-zero</SelectItem>
								<SelectItem value="evenodd">Even-odd</SelectItem>
							</SelectContent>
						</Select>
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
								onChange={(e) => onChange({ opacity: Number(e.target.value) })}
								className="flex-1"
							/>
							<span className={`${typography.helperText} w-10 text-right`}>
								{Math.round((element.opacity ?? 1) * 100)}%
							</span>
						</div>
					</div>
				</div>

				{/* Gradient Fill */}
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
												colors: ["#3b82f6", "#8b5cf6"],
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
								<Label className={typography.fieldLabel}>Type</Label>
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
									<Label className={typography.fieldLabel}>Angle</Label>
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
								<Label className={typography.fieldLabel}>Colors</Label>
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
			</section>

			{/* Stroke Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Stroke</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke Color</Label>
						<Input
							type="color"
							value={element.stroke || "#000000"}
							onChange={(e) => onChange({ stroke: e.target.value })}
							className={`w-12 ${components.inputHeight} p-1 cursor-pointer`}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke Width</Label>
						<Input
							type="number"
							min="0"
							max="20"
							value={element.strokeWidth || 0}
							onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stroke Style</Label>
						<Select
							value={element.strokeStyle || "solid"}
							onValueChange={(v) => onChange({ strokeStyle: v as "solid" | "dashed" | "dotted" })}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="solid">Solid</SelectItem>
								<SelectItem value="dashed">Dashed</SelectItem>
								<SelectItem value="dotted">Dotted</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Line Cap</Label>
						<Select
							value={element.strokeLinecap || "butt"}
							onValueChange={(v) => onChange({ strokeLinecap: v as "butt" | "round" | "square" })}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="butt">Butt</SelectItem>
								<SelectItem value="round">Round</SelectItem>
								<SelectItem value="square">Square</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Line Join</Label>
						<Select
							value={element.strokeLinejoin || "miter"}
							onValueChange={(v) => onChange({ strokeLinejoin: v as "miter" | "round" | "bevel" })}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="miter">Miter</SelectItem>
								<SelectItem value="round">Round</SelectItem>
								<SelectItem value="bevel">Bevel</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>

			{/* Advanced Options */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Advanced</h4>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Blend Mode</Label>
					<Select
						value={element.blendMode || "normal"}
						onValueChange={(v) =>
							onChange({
								blendMode: v as NonNullable<
									Extract<TemplateElement, { type: "path" }>["blendMode"]
								>,
							})
						}
					>
						<SelectTrigger className={components.inputHeight}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="normal">Normal</SelectItem>
							<SelectItem value="multiply">Multiply</SelectItem>
							<SelectItem value="screen">Screen</SelectItem>
							<SelectItem value="overlay">Overlay</SelectItem>
							<SelectItem value="darken">Darken</SelectItem>
							<SelectItem value="lighten">Lighten</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Shadow */}
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
												spread: 0,
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
									max="80"
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
								<Label className={typography.fieldLabel}>Offset X</Label>
								<Input
									type="number"
									min="-50"
									max="50"
									value={element.shadow.offsetX}
									onChange={(e) => {
										onChange({
											...element,
											shadow: {
												...element.shadow!,
												offsetX: Number(e.target.value),
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
									min="-50"
									max="50"
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
								<Label className={typography.fieldLabel}>Color</Label>
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
							</div>
						</div>
					)}
				</div>
			</section>

			{common}
		</div>
	);
}

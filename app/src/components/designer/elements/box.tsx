import { useTranslation } from "react-i18next";
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
	const { t } = useTranslation();
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
			<h3 className={typography.sectionTitle}>{t('designer.elementProperties.box.title')}</h3>
			
			{/* Box Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.box.styling')}</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.fill')}</Label>
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
								placeholder={t('designer.elementProperties.box.fillPlaceholder')}
								value={element.fill}
								onChange={(e) => {
									onChange({ ...element, fill: e.target.value });
								}}
								className={components.inputHeight}
							/>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.stroke')}</Label>
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
								placeholder={t('designer.elementProperties.box.strokePlaceholder')}
								value={element.stroke}
								onChange={(e) => {
									onChange({ ...element, stroke: e.target.value });
								}}
								className={components.inputHeight}
							/>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.strokeWidth')}</Label>
						<Input
							type="number"
							placeholder={t('designer.elementProperties.box.strokeWidthPlaceholder')}
							value={element.strokeWidth}
							onChange={(e) => {
								onChange({ ...element, strokeWidth: Number(e.target.value) });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.cornerRadius')}</Label>
						<Input
							type="number"
							placeholder={t('designer.elementProperties.box.cornerRadiusPlaceholder')}
							value={element.radius}
							onChange={(e) => {
								onChange({ ...element, radius: Number(e.target.value) });
							}}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.opacity')}</Label>
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
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.gradientFill')}</Label>
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
								<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.gradientType')}</Label>
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
										<SelectItem value="linear">{t('designer.elementProperties.box.gradientTypes.linear')}</SelectItem>
										<SelectItem value="radial">{t('designer.elementProperties.box.gradientTypes.radial')}</SelectItem>
									</SelectContent>
								</Select>
							</div>
							
							{element.fillGradient.type === "linear" && (
								<div className={components.field}>
									<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.angle')}</Label>
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
								<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.colors')}</Label>
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
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.shadow')}</Label>
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
								<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.blur')}</Label>
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
								<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.offsetY')}</Label>
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
								<Label className={typography.fieldLabel}>{t('designer.elementProperties.box.shadowColor')}</Label>
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

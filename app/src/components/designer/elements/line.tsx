import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { TemplateElement } from "@/core";
import { typography, separators, components } from "../design-system";

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
			<h3 className={typography.sectionTitle}>{t('designer.elementProperties.line.title')}</h3>
			
			{/* Line Styling */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.line.styling')}</h4>
					<div className={components.grid}>
						<div className={components.field}>
							<Label className={typography.fieldLabel}>{t('designer.elementProperties.line.stroke')}</Label>
							<ColorPicker
								value={element.stroke || "#111827"}
								onChange={(color) => {
									const ln = element as Extract<TemplateElement, { type: "line" }>;
									onChange({ ...ln, stroke: color });
								}}
							/>
						</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.line.strokeWidth')}</Label>
						<Input
							type="number"
							placeholder={t('designer.elementProperties.line.strokeWidthPlaceholder')}
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

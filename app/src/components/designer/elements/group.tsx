import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TemplateElement } from "@/core";
import { typography, separators, components } from "../design-system";

interface GroupElementProps {
	previewMode?: boolean;
}

export default function GroupElement({ previewMode }: GroupElementProps) {
	if (previewMode) return null;
	return (
		<div className="absolute inset-0 border-2 border-dashed border-primary/40 rounded-sm pointer-events-none" />
	);
}

interface GroupPropertiesProps {
	element: Extract<TemplateElement, { type: "group" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	childCount?: number;
	isNarrow?: boolean;
}

export function GroupProperties({ element, onChange, childCount = 0, isNarrow }: GroupPropertiesProps) {
	const { t } = useTranslation();

	return (
		<div className={components.section}>
			<h3 className={typography.sectionTitle}>Group</h3>

			<section className={`${components.section} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>Label</h4>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Name</Label>
					<Input
						value={element.label ?? ""}
						placeholder="Group label"
						onChange={(e) => onChange({ label: e.target.value })}
						className={components.inputHeight}
					/>
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					Contains {childCount} element{childCount !== 1 ? "s" : ""}
				</p>
			</section>

			<section className={`${components.section} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.common.positionAndSize')}</h4>
				<p className="text-xs text-muted-foreground">
					Bounding box is computed from children. Move or resize individual elements to adjust.
				</p>
				<div className={isNarrow ? components.gridNarrow : components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.x')}</Label>
						<Input type="number" value={Math.round(element.x)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.y')}</Label>
						<Input type="number" value={Math.round(element.y)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.width')}</Label>
						<Input type="number" value={Math.round(element.width)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.height')}</Label>
						<Input type="number" value={Math.round(element.height)} disabled className={components.inputHeight} />
					</div>
				</div>
			</section>
		</div>
	);
}

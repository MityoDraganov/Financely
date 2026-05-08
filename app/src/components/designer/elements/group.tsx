import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import type { TemplateElement } from "@/core";
import { typography, separators, components } from "../design-system";

interface GroupElementProps {
	element: Extract<TemplateElement, { type: "group" }>;
	previewMode?: boolean;
}

export default function GroupElement({ element, previewMode }: GroupElementProps) {
	const rawBg = element.backgroundColor?.trim();
	const bg = rawBg && rawBg.length > 0 ? rawBg : undefined;

	return (
		<div
			className={`absolute inset-0 rounded-sm pointer-events-none ${previewMode ? "" : "border-2 border-dashed border-primary/40"}`}
			style={{
				backgroundColor: bg,
			}}
		/>
	);
}

interface GroupPropertiesProps {
	element: Extract<TemplateElement, { type: "group" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	childCount?: number;
	isNarrow?: boolean;
}

export function GroupProperties({
	element,
	onChange,
	childCount = 0,
	isNarrow,
}: GroupPropertiesProps) {
	const { t } = useTranslation();
	const pad = element.innerPadding ?? {
		top: 12,
		right: 12,
		bottom: 12,
		left: 12,
	};

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
				<h4 className={typography.subsectionTitle}>Appearance</h4>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Background</Label>
					<ColorPicker
						value={element.backgroundColor ?? "#ffffff"}
						onChange={(color) =>
							onChange({
								backgroundColor: color.trim().length === 0 ? undefined : color,
							})
						}
						allowTransparent
						transparentLabel={t("designer.elementProperties.text.transparent", "Transparent")}
					/>
				</div>
				<p className="text-xs text-muted-foreground mt-2">
					The box expands with nested elements; padding keeps space inside the edges.
				</p>
			</section>

			<section className={`${components.section} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>Inner padding</h4>
				<div className={isNarrow ? components.gridNarrow : components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Top</Label>
						<Input
							type="number"
							min={0}
							value={pad.top}
							onChange={(e) =>
								onChange({
									innerPadding: { ...pad, top: Number(e.target.value) },
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Bottom</Label>
						<Input
							type="number"
							min={0}
							value={pad.bottom}
							onChange={(e) =>
								onChange({
									innerPadding: { ...pad, bottom: Number(e.target.value) },
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Left</Label>
						<Input
							type="number"
							min={0}
							value={pad.left}
							onChange={(e) =>
								onChange({
									innerPadding: { ...pad, left: Number(e.target.value) },
								})
							}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Right</Label>
						<Input
							type="number"
							min={0}
							value={pad.right}
							onChange={(e) =>
								onChange({
									innerPadding: { ...pad, right: Number(e.target.value) },
								})
							}
							className={components.inputHeight}
						/>
					</div>
				</div>
			</section>

			<section className={`${components.section} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>{t("designer.elementProperties.common.positionAndSize")}</h4>
				<p className="text-xs text-muted-foreground">
					Bounding box follows nested elements plus inner padding. Move or resize children to adjust.
				</p>
				<div className={isNarrow ? components.gridNarrow : components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.x")}</Label>
						<Input type="number" value={Math.round(element.x)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.y")}</Label>
						<Input type="number" value={Math.round(element.y)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.width")}</Label>
						<Input type="number" value={Math.round(element.width)} disabled className={components.inputHeight} />
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.height")}</Label>
						<Input type="number" value={Math.round(element.height)} disabled className={components.inputHeight} />
					</div>
				</div>
			</section>
		</div>
	);
}

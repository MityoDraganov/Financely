import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { resolveTemplateImageSource } from "@/utils/template-image-source";
import { AlertCircle, Check, Image as ImageIcon } from "lucide-react";
import { typography, spacing, separators, components, colors } from "../design-system";

interface ImageElementProps {
	element: Extract<TemplateElement, { type: "image" }>;
}

export default function ImageElement({ element }: ImageElementProps) {
	const { t } = useTranslation();
	const { data: organization } = useCurrentOrganization();
	const img = element;
	const resolvedSource = resolveTemplateImageSource(
		img.src,
		undefined,
		organization?.settings?.branding?.customLogo || organization?.logoUrl
	);
	
	return resolvedSource ? (
		<img
			src={resolvedSource}
			alt={img.alt ?? ""}
			draggable={false}
			style={{ width: "100%", height: "100%", objectFit: img.objectFit, pointerEvents: "none" }}
		/>
	) : (
		<div className="w-full h-full bg-muted grid place-items-center text-muted-foreground">
			{t('designer.elementProperties.image.title')}
		</div>
	);
}

interface ImagePropertiesProps {
	element: Extract<TemplateElement, { type: "image" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
	allElements?: TemplateElement[];
	onOpenImagePicker?: (elementId: string) => void;
}

export function ImageProperties({ element, onChange, isNarrow, allElements = [], onOpenImagePicker }: ImagePropertiesProps) {
	const { t } = useTranslation();
	const [bindingInput, setBindingInput] = useState(element.binding ?? "");
	
	// Check for duplicate bindings
	const hasDuplicateBinding = (binding: string | undefined): boolean => {
		if (!binding) return false;
		return allElements.some((el) => {
			if (el.id === element.id) return false; // Don't check against self
			if (el.type === "text" || el.type === "input" || el.type === "image") {
				return el.binding === binding;
			}
			if (el.type === "table") {
				return el.itemsBinding === binding;
			}
			return false;
		});
	};
	
	// Generate a unique binding suggestion
	const getUniqueBinding = (binding: string): string => {
		if (!binding) return "";
		let counter = 1;
		let suggested = binding;
		while (hasDuplicateBinding(suggested)) {
			suggested = `${binding} (${counter})`;
			counter++;
		}
		return suggested;
	};
	
	const bindingError = hasDuplicateBinding(bindingInput);
	const suggestedBinding = bindingError ? getUniqueBinding(bindingInput) : null;
	
	// Sync with element binding when it changes externally
	useEffect(() => {
		setBindingInput(element.binding ?? "");
	}, [element.binding]);
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
			<h3 className={typography.sectionTitle}>{t('designer.elementProperties.image.title')}</h3>
			
			{/* Image Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.image.settings')}</h4>
				<div className={components.grid}>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.image.imageUrl')}</Label>
						<div className="relative">
							<Input
								placeholder={t('designer.elementProperties.image.imageUrlPlaceholder')}
								value={element.src}
								onChange={(e) => {
									const img = element as Extract<TemplateElement, { type: "image" }>;
									onChange({ ...img, src: e.target.value });
								}}
								className={`${components.inputHeight} ${onOpenImagePicker ? "pr-9" : ""}`}
							/>
							{onOpenImagePicker && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={() => onOpenImagePicker(element.id)}
									className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
								>
									<ImageIcon className="h-4 w-4" />
								</Button>
							)}
						</div>
					</div>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.image.dataBinding')}</Label>
						<div className={spacing.fieldGroupGap}>
							<Input
								placeholder={t('designer.elementProperties.image.bindingPlaceholder')}
								value={bindingInput}
								className={`${components.inputHeight} ${bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
								onChange={(e) => {
									const newValue = e.target.value;
									setBindingInput(newValue);
									const img = element as Extract<TemplateElement, { type: "image" }>;
									onChange({ ...img, binding: newValue || undefined });
								}}
							/>
							{bindingError && suggestedBinding && (
								<div className={`flex items-start gap-2 p-2.5 ${colors.bgWarning} border ${colors.borderDefault} rounded-md`}>
									<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className={`${typography.errorText} mb-1.5`}>
											{t('designer.elementProperties.binding.duplicateError')}
										</p>
										<div className="flex items-center gap-2">
											<p className={`${typography.errorTextSecondary} flex-1 truncate`}>
												{t('designer.elementProperties.binding.suggested')} <span className="font-mono font-medium">{suggestedBinding}</span>
											</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2.5 text-xs border-amber-300 dark:border-amber-700 bg-background hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
												onClick={() => {
													setBindingInput(suggestedBinding);
													const img = element as Extract<TemplateElement, { type: "image" }>;
													onChange({ ...img, binding: suggestedBinding });
												}}
											>
												<Check className="h-3 w-3 mr-1" />
												{t('designer.elementProperties.binding.use')}
											</Button>
										</div>
									</div>
								</div>
							)}
							<p className={typography.helperText}>
								{t('designer.elementProperties.image.bindingHint')}
							</p>
						</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.image.objectFit')}</Label>
						<Select
							value={element.objectFit}
							onValueChange={(v) => {
								const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, objectFit: v as Extract<TemplateElement, { type: "image" }>["objectFit"] });
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="contain">{t('designer.elementProperties.image.objectFitOptions.contain')}</SelectItem>
								<SelectItem value="cover">{t('designer.elementProperties.image.objectFitOptions.cover')}</SelectItem>
								<SelectItem value="fill">{t('designer.elementProperties.image.objectFitOptions.fill')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</section>
			
			{common}
		</div>
	);
}

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
import type { Organization } from "@/core/entities/organization";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
	resolveTemplateImageSource,
	type TemplateImageResolutionMode,
	type OrganizationImageAssetRef,
} from "@/utils/template-image-source";
import { Image as ImageIcon } from "lucide-react";
import { typography, separators, components } from "../design-system";
import { FieldCombobox } from "@/components/designer/field-combobox";

interface ImageElementProps {
	element: Extract<TemplateElement, { type: "image" }>;
	organizationOverride?: Organization;
	resolutionMode?: TemplateImageResolutionMode;
}

type ImageSourceMode = "static" | "binding" | "organizationAsset";

function getImageSourceMode(element: Extract<TemplateElement, { type: "image" }>): ImageSourceMode {
	if (element.assetRef) return "organizationAsset";
	if (element.binding) return "binding";
	return "static";
}

export default function ImageElement({
	element,
	organizationOverride,
	resolutionMode = "resolve-org-assets",
}: ImageElementProps) {
	const { t } = useTranslation();
	const { data: currentOrganization } = useCurrentOrganization();
	const organization = organizationOverride ?? currentOrganization;
	const img = element;
	const resolvedSource = resolveTemplateImageSource(
		img.src,
		undefined,
		organization?.settings?.branding?.customLogo || organization?.logoUrl,
		{
			assetRef: img.assetRef,
			fallbackFaviconUrl: organization?.settings?.branding?.customFavicon,
			mode: resolutionMode,
		}
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

export function ImageProperties({ element, onChange, isNarrow, allElements: _allElements = [], onOpenImagePicker }: ImagePropertiesProps) {
	const { t } = useTranslation();
	const sourceMode = getImageSourceMode(element);
	const updateImageElement = (
		partial: Partial<Extract<TemplateElement, { type: "image" }>>
	) => {
		onChange({ ...element, ...partial });
	};
	const setSourceMode = (mode: ImageSourceMode) => {
		if (mode === "static") {
			updateImageElement({
				assetRef: null,
				binding: "",
				fieldId: "",
				isCustomBinding: false,
			});
			return;
		}

		if (mode === "binding") {
			updateImageElement({
				assetRef: null,
			});
			return;
		}

		updateImageElement({
			assetRef: element.assetRef || "organization.logo",
			binding: "",
			fieldId: "",
			isCustomBinding: false,
		});
	};

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
					<div className={components.field}>
						<Label className={typography.fieldLabel}>
							{t("designer.elementProperties.image.sourceType", { defaultValue: "Source Type" })}
						</Label>
						<Select value={sourceMode} onValueChange={(value) => setSourceMode(value as ImageSourceMode)}>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="static">
									{t("designer.elementProperties.image.sourceTypeOptions.static", { defaultValue: "Fixed image" })}
								</SelectItem>
								<SelectItem value="binding">
									{t("designer.elementProperties.image.sourceTypeOptions.binding", { defaultValue: "From document data" })}
								</SelectItem>
								<SelectItem value="organizationAsset">
									{t("designer.elementProperties.image.sourceTypeOptions.organizationAsset", {
										defaultValue: "Organization branding",
									})}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{sourceMode === "organizationAsset" && (
						<div className={components.field}>
								<Label className={typography.fieldLabel}>
									{t("designer.elementProperties.image.organizationAsset", { defaultValue: "Brand image" })}
								</Label>
							<Select
								value={(element.assetRef || "organization.logo") as OrganizationImageAssetRef}
								onValueChange={(value) =>
									updateImageElement({
										assetRef: value as OrganizationImageAssetRef,
										binding: "",
										fieldId: "",
										isCustomBinding: false,
									})
								}
							>
								<SelectTrigger className={components.inputHeight}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="organization.logo">
										{t("designer.elementProperties.image.organizationAssetOptions.logo", { defaultValue: "Logo" })}
									</SelectItem>
									<SelectItem value="organization.favicon">
										{t("designer.elementProperties.image.organizationAssetOptions.favicon", { defaultValue: "Favicon" })}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>
							{sourceMode === "organizationAsset"
								? t("designer.elementProperties.image.fallbackImageUrl", {
										defaultValue: "Preview image (Original view)",
									})
								: t('designer.elementProperties.image.imageUrl')}
						</Label>
						<div className="relative">
							<Input
								placeholder={t('designer.elementProperties.image.imageUrlPlaceholder')}
								value={element.src}
								onChange={(e) => {
									updateImageElement({
										src: e.target.value,
										...(sourceMode === "static" ? { assetRef: null } : {}),
									});
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
					{sourceMode === "binding" && (
						<div className={components.field}>
							<Label className={typography.fieldLabel}>{t('designer.elementProperties.binding.dataBinding')}</Label>
							<FieldCombobox
								value={element.binding}
								fieldId={element.fieldId}
								onSelect={(fieldId, binding) => {
									updateImageElement({
										binding: binding || "",
										fieldId,
										isCustomBinding: false,
										assetRef: null,
									});
								}}
								onCustomBinding={(binding) => {
									updateImageElement({
										binding,
										fieldId: "",
										isCustomBinding: true,
										assetRef: null,
									});
								}}
							/>
						</div>
					)}
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

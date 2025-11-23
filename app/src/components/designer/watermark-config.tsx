import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Template } from "@/core";
import type { UseMutationResult } from "@tanstack/react-query";
import type { TemplateData } from "@/core";
import { typography, spacing, separators, components } from "./design-system";
import { toast } from "sonner";

type WatermarkConfigProps = {
	template: Template;
	organizationLogo?: string;
	saveMutation: UseMutationResult<void, Error, Partial<TemplateData>, unknown>;
};

export function WatermarkConfig({ template, organizationLogo, saveMutation }: WatermarkConfigProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	
	// Ensure brand object exists (defensive check for AI-generated templates)
	const brand = template.brand || {
		fonts: ["Inter"],
		colors: {
			primary: "#111827",
			secondary: "#6b7280",
			accent: "#2563eb",
		},
		margins: { top: 40, right: 40, bottom: 40, left: 40 },
	};
	
	// Helper function to wrap mutations with error handling
	const handleMutation = (
		data: Partial<TemplateData>,
		options?: {
			onSuccess?: () => void;
			skipErrorToast?: boolean;
		}
	) => {
		saveMutation.mutate(data, {
			onError: (error) => {
				console.error("Failed to save watermark setting:", error);
				if (!options?.skipErrorToast) {
					toast.error(t('designer.watermark.saveError', {
						defaultValue: "Failed to save watermark settings. Please try again."
					}));
				}
			},
			onSuccess: options?.onSuccess,
		});
	};
	
	return (
		<section className={`${components.section} ${separators.sectionDivider}`}>
			<h3 className={typography.sectionTitle}>{t('designer.watermark.title')}</h3>
			<div className={components.subsection}>
				<div className={`${components.field} flex items-center justify-between`}>
					<Label htmlFor="watermark-enabled" className={typography.fieldLabel}>{t('designer.watermark.enable')}</Label>
					<input
						id="watermark-enabled"
						type="checkbox"
						checked={brand.watermark?.enabled ?? false}
						onChange={(e) => {
							const isEnabling = e.target.checked;
							const currentWatermark = brand.watermark || {
								enabled: false,
								position: "center" as const,
								width: 200,
								rotation: 0,
								opacity: 0.1,
								blendMode: "normal" as const,
								repeat: "none" as const,
							};
							
							// If enabling watermark, use organization logo if available
							if (isEnabling && !currentWatermark.imageUrl && !currentWatermark.text) {
								if (organizationLogo) {
									// Automatically use organization logo
									handleMutation(
										{
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													enabled: true,
													imageUrl: organizationLogo,
												},
											},
										},
										{
											onSuccess: () => {
												toast.success(t('designer.watermark.enabled', {
													defaultValue: "Watermark enabled with organization logo"
												}));
											},
										}
									);
									return;
								}
								
								// No logo available, show warning with link to settings
								toast.warning(
									t('designer.watermark.logoRequired', {
										defaultValue: "Organization logo is required to enable watermark"
									}),
									{
										action: {
											label: t('designer.watermark.goToSettings', {
												defaultValue: "Go to Settings"
											}),
											onClick: () => navigate("/settings/organization/branding"),
										},
										duration: 5000,
									}
								);
								return;
							}
							
							handleMutation(
								{
									brand: {
										...brand,
										watermark: {
											...currentWatermark,
											enabled: isEnabling,
											imageUrl: currentWatermark.imageUrl,
										},
									},
								},
								{
									onSuccess: () => {
										if (isEnabling) {
											toast.success(t('designer.watermark.enabled', {
												defaultValue: "Watermark enabled"
											}));
										}
									},
								}
							);
						}}
						className="h-4 w-4 rounded border-gray-300"
					/>
				</div>
				{brand.watermark?.enabled && (
					<div className={`${separators.nestedContent} ${spacing.fieldGroupGap}`}>
						<div className={components.field}>
							<Label htmlFor="watermark-type" className={typography.fieldLabel}>{t('designer.watermark.type')}</Label>
							<Select
								value={brand.watermark?.imageUrl ? "image" : "text"}
								onValueChange={(v) => {
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									
									const imageUrl = v === "image" ? (organizationLogo || currentWatermark.imageUrl) : undefined;
									const text = v === "text" ? (currentWatermark.text || t('designer.watermark.textPlaceholder')) : undefined;
									
									// If switching to image but no image URL available, show warning
									if (v === "image" && !imageUrl) {
										toast.warning(t('designer.watermark.imageUrlRequired', {
											defaultValue: "Please provide an image URL for the watermark"
										}));
									}
									
									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												imageUrl,
												text,
											},
										},
									});
								}}
							>
								<SelectTrigger className={components.inputHeight}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="image">{t('designer.watermark.image')}</SelectItem>
									<SelectItem value="text">{t('designer.watermark.text')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{brand.watermark?.imageUrl ? (
							<div className={components.field}>
								<Label htmlFor="watermark-image-url" className={typography.fieldLabel}>{t('designer.watermark.imageUrl')}</Label>
								<Input
									id="watermark-image-url"
									value={brand.watermark?.imageUrl || ""}
									onChange={(e) => {
										const currentWatermark = brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										const imageUrl = e.target.value || undefined;
										
										// Validate URL format if provided
										if (imageUrl && !imageUrl.match(/^https?:\/\/.+/)) {
											toast.warning(t('designer.watermark.invalidUrl', {
												defaultValue: "Please enter a valid URL starting with http:// or https://"
											}));
											return;
										}
										
										handleMutation({
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													imageUrl,
												},
											},
										});
									}}
									placeholder="https://example.com/logo.png"
									className={`${components.inputHeight} text-xs`}
								/>
							</div>
						) : (
							<div className={components.field}>
								<Label htmlFor="watermark-text" className={typography.fieldLabel}>{t('designer.watermark.text')}</Label>
								<Input
									id="watermark-text"
									value={brand.watermark?.text || ""}
									onChange={(e) => {
										const currentWatermark = brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										handleMutation({
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													text: e.target.value || undefined,
												},
											},
										});
									}}
									placeholder={t('designer.watermark.textPlaceholder')}
									className={`${components.inputHeight} text-xs`}
								/>
							</div>
						)}
						<div className={components.field}>
							<Label htmlFor="watermark-position" className={typography.fieldLabel}>{t('designer.watermark.position')}</Label>
							<Select
								value={brand.watermark?.position || "center"}
								onValueChange={(v) => {
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												position: v as typeof currentWatermark.position,
											},
										},
									});
								}}
							>
								<SelectTrigger className={components.inputHeight}>
									<SelectValue />
								</SelectTrigger>
							<SelectContent>
								<SelectItem value="center">{t('designer.watermark.positions.center')}</SelectItem>
								<SelectItem value="top-left">{t('designer.watermark.positions.topLeft')}</SelectItem>
								<SelectItem value="top-right">{t('designer.watermark.positions.topRight')}</SelectItem>
								<SelectItem value="bottom-left">{t('designer.watermark.positions.bottomLeft')}</SelectItem>
								<SelectItem value="bottom-right">{t('designer.watermark.positions.bottomRight')}</SelectItem>
								<SelectItem value="top-center">{t('designer.watermark.positions.topCenter')}</SelectItem>
								<SelectItem value="bottom-center">{t('designer.watermark.positions.bottomCenter')}</SelectItem>
								<SelectItem value="left-center">{t('designer.watermark.positions.leftCenter')}</SelectItem>
								<SelectItem value="right-center">{t('designer.watermark.positions.rightCenter')}</SelectItem>
							</SelectContent>
							</Select>
						</div>
						<div className={components.grid}>
							<div className={components.field}>
								<Label htmlFor="watermark-width" className={typography.fieldLabel}>{t('designer.watermark.width')}</Label>
							<Input
								id="watermark-width"
								type="number"
								value={brand.watermark?.width ?? ""}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};

									let widthValue: number | undefined;
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										widthValue = undefined;
									} else {
										const numValue = Number(inputValue);
										widthValue = isNaN(numValue) ? undefined : numValue;
									}

									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												width: widthValue ?? currentWatermark.width ?? 200,
											},
										},
									});
								}}
								onBlur={(e) => {
									const inputValue = e.target.value.trim();
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										const currentWatermark = brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										handleMutation({
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													width: 200,
												},
											},
										});
									}
								}}
								className={`${components.inputHeight} text-xs`}
							/>
						</div>
						<div className={components.field}>
							<Label htmlFor="watermark-height" className={typography.fieldLabel}>{t('designer.watermark.height')}</Label>
							<Input
								id="watermark-height"
								type="number"
								min={50}
								max={1000}
								value={brand.watermark?.height || ""}
								onChange={(e) => {
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									const heightValue = e.target.value ? Number(e.target.value) : undefined;
									
									// Validate height range
									if (heightValue !== undefined && (heightValue < 50 || heightValue > 1000)) {
										toast.warning(t('designer.watermark.heightRange', {
											defaultValue: "Height must be between 50 and 1000 pixels"
										}));
										return;
									}
									
									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												height: heightValue,
											},
										},
									});
								}}
								placeholder="Auto"
								className={`${components.inputHeight} text-xs`}
							/>
						</div>
					</div>
					<div className={components.field}>
						<Label htmlFor="watermark-rotation" className={typography.fieldLabel}>{t('designer.watermark.rotation')}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="watermark-rotation-slider"
								type="range"
								min={-180}
								max={180}
								value={brand.watermark?.rotation || 0}
								onChange={(e) => {
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												rotation: Number(e.target.value),
											},
										},
									}, { skipErrorToast: true }); // Skip toast for slider changes (too frequent)
								}}
								className="h-2 flex-1"
							/>
							<Input
								id="watermark-rotation-input"
								type="number"
								min={-180}
								max={180}
								step={1}
								value={brand.watermark?.rotation ?? ""}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};

									let rotationValue: number;
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										rotationValue = currentWatermark.rotation ?? 0;
									} else {
										const numValue = Number(inputValue);
										rotationValue = isNaN(numValue) ? currentWatermark.rotation ?? 0 : Math.max(-180, Math.min(180, numValue));
									}

									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												rotation: rotationValue,
											},
										},
									});
								}}
								onBlur={(e) => {
									const inputValue = e.target.value.trim();
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										const currentWatermark = brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										handleMutation({
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													rotation: currentWatermark.rotation ?? 0,
												},
											},
										});
									}
								}}
								className={`${components.inputHeightSmall} w-20 text-xs`}
								placeholder="0"
							/>
							<span className={`${typography.helperText} w-4`}>°</span>
						</div>
					</div>
					<div className={components.field}>
						<Label htmlFor="watermark-opacity" className={typography.fieldLabel}>{t('designer.watermark.opacity')}</Label>
						<div className="flex items-center gap-2">
							<Input
								id="watermark-opacity-slider"
								type="range"
								min={0}
								max={100}
								step={1}
								value={Math.round((brand.watermark?.opacity || 0.1) * 100)}
								onChange={(e) => {
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												opacity: Number(e.target.value) / 100,
											},
										},
									}, { skipErrorToast: true }); // Skip toast for slider changes (too frequent)
								}}
								className="h-2 flex-1"
							/>
							<Input
								id="watermark-opacity-input"
								type="number"
								min={0}
								max={100}
								step={1}
								value={(() => {
									const opacity = brand.watermark?.opacity ?? 0.1;
									return Math.round(opacity * 100);
								})()}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};

									let opacityValue: number;
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										opacityValue = currentWatermark.opacity ?? 0.1;
									} else {
										const numValue = Number(inputValue);
										opacityValue = isNaN(numValue) ? currentWatermark.opacity ?? 0.1 : Math.max(0, Math.min(100, numValue)) / 100;
									}

									handleMutation({
										brand: {
											...brand,
											watermark: {
												...currentWatermark,
												opacity: opacityValue,
											},
										},
									});
								}}
								onBlur={(e) => {
									const inputValue = e.target.value.trim();
									if (inputValue === "" || inputValue === null || inputValue === undefined) {
										const currentWatermark = brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										handleMutation({
											brand: {
												...brand,
												watermark: {
													...currentWatermark,
													opacity: currentWatermark.opacity ?? 0.1,
												},
											},
										});
									}
								}}
								className={`${components.inputHeightSmall} w-20 text-xs`}
								placeholder="10"
							/>
							<span className={`${typography.helperText} w-4`}>%</span>
						</div>
					</div>
					<div className={components.field}>
						<Label htmlFor="watermark-repeat" className={typography.fieldLabel}>{t('designer.watermark.repeat')}</Label>
						<Select
							value={brand.watermark?.repeat || "none"}
							onValueChange={(v) => {
								const currentWatermark = brand.watermark || {
									enabled: true,
									position: "center" as const,
									width: 200,
									rotation: 0,
									opacity: 0.1,
									blendMode: "normal" as const,
									repeat: "none" as const,
								};
								handleMutation({
									brand: {
										...brand,
										watermark: {
											...currentWatermark,
											repeat: v as typeof currentWatermark.repeat,
										},
									},
								});
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">{t('designer.watermark.repeatOptions.none')}</SelectItem>
								<SelectItem value="repeat">{t('designer.watermark.repeatOptions.repeat')}</SelectItem>
								<SelectItem value="repeat-x">{t('designer.watermark.repeatOptions.repeatX')}</SelectItem>
								<SelectItem value="repeat-y">{t('designer.watermark.repeatOptions.repeatY')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}
			</div>
		</section>
	);
}


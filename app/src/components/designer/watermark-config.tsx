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

type WatermarkConfigProps = {
	template: Template;
	organizationLogo?: string;
	saveMutation: UseMutationResult<void, Error, Partial<TemplateData>, unknown>;
};

export function WatermarkConfig({ template, organizationLogo, saveMutation }: WatermarkConfigProps) {
	return (
		<section className={`${components.section} ${separators.sectionDivider}`}>
			<h3 className={typography.sectionTitle}>Watermark</h3>
			<div className={components.subsection}>
				<div className={`${components.field} flex items-center justify-between`}>
					<Label htmlFor="watermark-enabled" className={typography.fieldLabel}>Enable Watermark</Label>
					<input
						id="watermark-enabled"
						type="checkbox"
						checked={template.brand.watermark?.enabled ?? false}
						onChange={(e) => {
							const currentWatermark = template.brand.watermark || {
								enabled: false,
								position: "center" as const,
								width: 200,
								rotation: 0,
								opacity: 0.1,
								blendMode: "normal" as const,
								repeat: "none" as const,
							};
							saveMutation.mutate({
								brand: {
									...template.brand,
									watermark: {
										...currentWatermark,
										enabled: e.target.checked,
										imageUrl: currentWatermark.imageUrl,
									},
								},
							});
						}}
						className="h-4 w-4 rounded border-gray-300"
					/>
				</div>
				{template.brand.watermark?.enabled && (
					<div className={`${separators.nestedContent} ${spacing.fieldGroupGap}`}>
						<div className={components.field}>
							<Label htmlFor="watermark-type" className={typography.fieldLabel}>Type</Label>
							<Select
								value={template.brand.watermark?.imageUrl ? "image" : "text"}
								onValueChange={(v) => {
									const currentWatermark = template.brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									saveMutation.mutate({
										brand: {
											...template.brand,
											watermark: {
												...currentWatermark,
												imageUrl: v === "image" ? (organizationLogo || currentWatermark.imageUrl) : undefined,
												text: v === "text" ? (currentWatermark.text || "CONFIDENTIAL") : undefined,
											},
										},
									});
								}}
							>
								<SelectTrigger className={components.inputHeight}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="image">Image</SelectItem>
									<SelectItem value="text">Text</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{template.brand.watermark?.imageUrl ? (
							<div className={components.field}>
								<Label htmlFor="watermark-image-url" className={typography.fieldLabel}>Image URL</Label>
								<Input
									id="watermark-image-url"
									value={template.brand.watermark.imageUrl || ""}
									onChange={(e) => {
										const currentWatermark = template.brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										saveMutation.mutate({
											brand: {
												...template.brand,
												watermark: {
													...currentWatermark,
													imageUrl: e.target.value || undefined,
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
								<Label htmlFor="watermark-text" className={typography.fieldLabel}>Text</Label>
								<Input
									id="watermark-text"
									value={template.brand.watermark?.text || ""}
									onChange={(e) => {
										const currentWatermark = template.brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										saveMutation.mutate({
											brand: {
												...template.brand,
												watermark: {
													...currentWatermark,
													text: e.target.value || undefined,
												},
											},
										});
									}}
									placeholder="CONFIDENTIAL"
									className={`${components.inputHeight} text-xs`}
								/>
							</div>
						)}
						<div className={components.field}>
							<Label htmlFor="watermark-position" className={typography.fieldLabel}>Position</Label>
							<Select
								value={template.brand.watermark?.position || "center"}
								onValueChange={(v) => {
									const currentWatermark = template.brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									saveMutation.mutate({
										brand: {
											...template.brand,
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
									<SelectItem value="center">Center</SelectItem>
									<SelectItem value="top-left">Top Left</SelectItem>
									<SelectItem value="top-right">Top Right</SelectItem>
									<SelectItem value="bottom-left">Bottom Left</SelectItem>
									<SelectItem value="bottom-right">Bottom Right</SelectItem>
									<SelectItem value="top-center">Top Center</SelectItem>
									<SelectItem value="bottom-center">Bottom Center</SelectItem>
									<SelectItem value="left-center">Left Center</SelectItem>
									<SelectItem value="right-center">Right Center</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className={components.grid}>
							<div className={components.field}>
								<Label htmlFor="watermark-width" className={typography.fieldLabel}>Width (px)</Label>
							<Input
								id="watermark-width"
								type="number"
								value={template.brand.watermark?.width ?? ""}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = template.brand.watermark || {
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

									saveMutation.mutate({
										brand: {
											...template.brand,
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
										const currentWatermark = template.brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										saveMutation.mutate({
											brand: {
												...template.brand,
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
							<Label htmlFor="watermark-height" className={typography.fieldLabel}>Height (px)</Label>
							<Input
								id="watermark-height"
								type="number"
								min={50}
								max={1000}
								value={template.brand.watermark?.height || ""}
								onChange={(e) => {
									const currentWatermark = template.brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									saveMutation.mutate({
										brand: {
											...template.brand,
											watermark: {
												...currentWatermark,
												height: e.target.value ? Number(e.target.value) : undefined,
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
						<Label htmlFor="watermark-rotation" className={typography.fieldLabel}>Rotation</Label>
						<div className="flex items-center gap-2">
							<Input
								id="watermark-rotation-slider"
								type="range"
								min={-180}
								max={180}
								value={template.brand.watermark?.rotation || 0}
								onChange={(e) => {
									const currentWatermark = template.brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									saveMutation.mutate({
										brand: {
											...template.brand,
											watermark: {
												...currentWatermark,
												rotation: Number(e.target.value),
											},
										},
									});
								}}
								className="h-2 flex-1"
							/>
							<Input
								id="watermark-rotation-input"
								type="number"
								min={-180}
								max={180}
								step={1}
								value={template.brand.watermark?.rotation ?? ""}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = template.brand.watermark || {
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

									saveMutation.mutate({
										brand: {
											...template.brand,
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
										const currentWatermark = template.brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										saveMutation.mutate({
											brand: {
												...template.brand,
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
						<Label htmlFor="watermark-opacity" className={typography.fieldLabel}>Opacity</Label>
						<div className="flex items-center gap-2">
							<Input
								id="watermark-opacity-slider"
								type="range"
								min={0}
								max={100}
								step={1}
								value={Math.round((template.brand.watermark?.opacity || 0.1) * 100)}
								onChange={(e) => {
									const currentWatermark = template.brand.watermark || {
										enabled: true,
										position: "center" as const,
										width: 200,
										rotation: 0,
										opacity: 0.1,
										blendMode: "normal" as const,
										repeat: "none" as const,
									};
									saveMutation.mutate({
										brand: {
											...template.brand,
											watermark: {
												...currentWatermark,
												opacity: Number(e.target.value) / 100,
											},
										},
									});
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
									const opacity = template.brand.watermark?.opacity ?? 0.1;
									return Math.round(opacity * 100);
								})()}
								onChange={(e) => {
									const inputValue = e.target.value;
									const currentWatermark = template.brand.watermark || {
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

									saveMutation.mutate({
										brand: {
											...template.brand,
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
										const currentWatermark = template.brand.watermark || {
											enabled: true,
											position: "center" as const,
											width: 200,
											rotation: 0,
											opacity: 0.1,
											blendMode: "normal" as const,
											repeat: "none" as const,
										};
										saveMutation.mutate({
											brand: {
												...template.brand,
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
						<Label htmlFor="watermark-blend-mode" className={typography.fieldLabel}>Blend Mode</Label>
						<Select
							value={template.brand.watermark?.blendMode || "normal"}
							onValueChange={(v) => {
								const currentWatermark = template.brand.watermark || {
									enabled: true,
									position: "center" as const,
									width: 200,
									rotation: 0,
									opacity: 0.1,
									blendMode: "normal" as const,
									repeat: "none" as const,
								};
								saveMutation.mutate({
									brand: {
										...template.brand,
										watermark: {
											...currentWatermark,
											blendMode: v as typeof currentWatermark.blendMode,
										},
									},
								});
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="normal">Normal</SelectItem>
								<SelectItem value="multiply">Multiply</SelectItem>
								<SelectItem value="screen">Screen</SelectItem>
								<SelectItem value="overlay">Overlay</SelectItem>
								<SelectItem value="soft-light">Soft Light</SelectItem>
								<SelectItem value="hard-light">Hard Light</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label htmlFor="watermark-repeat" className={typography.fieldLabel}>Repeat</Label>
						<Select
							value={template.brand.watermark?.repeat || "none"}
							onValueChange={(v) => {
								const currentWatermark = template.brand.watermark || {
									enabled: true,
									position: "center" as const,
									width: 200,
									rotation: 0,
									opacity: 0.1,
									blendMode: "normal" as const,
									repeat: "none" as const,
								};
								saveMutation.mutate({
									brand: {
										...template.brand,
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
								<SelectItem value="none">None</SelectItem>
								<SelectItem value="repeat">Repeat</SelectItem>
								<SelectItem value="repeat-x">Repeat X</SelectItem>
								<SelectItem value="repeat-y">Repeat Y</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}
			</div>
		</section>
	);
}


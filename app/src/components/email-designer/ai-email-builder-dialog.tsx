import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, Image as ImageIcon, X, Upload } from "lucide-react";
import { toast } from "sonner";
import type { EmailTemplate, EmailTemplateData } from "@/core";
import type { Organization } from "@/core/entities/organization";
import type { UseMutationResult } from "@tanstack/react-query";
import { emailTemplateService } from "@/services/email-template-service";
import { functionsService } from "@/services/functions/functions-service";
import { cn } from "@/lib/utils";
import type { DynamicSourceField } from "@/utils/dynamic-sources";

type GenerateEmailTemplatePayload = {
	organizationId: string;
	options?: {
		style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
		customPrompt?: string;
		images?: Array<{
			url: string;
			purpose: "reference" | "use-in-template";
			description?: string;
		}>;
		context?: {
			products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
			organizationName?: string;
			organizationSettings?: Record<string, unknown>;
			galleryImages?: string[];
		};
		allowedContexts?: string[];
		dynamicSources?: Array<{
			placeholderKey: string;
			entity: "product" | "contact" | "invoice" | "proposal";
			path: string;
			label?: string;
			description?: string;
			valueType?: "string" | "number" | "boolean" | "date" | "array" | "object" | "unknown";
			required?: boolean;
			sourceKind?: "field" | "metafield";
		}>;
		generateCustomHtml?: boolean;
		targetSection?: "header" | "body" | "footer" | "full";
	};
};

type AIEmailBuilderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentOrg: Organization | undefined;
	currentTemplate: EmailTemplate | undefined;
	templates: EmailTemplate[];
	generateTemplate: UseMutationResult<EmailTemplateData, Error, GenerateEmailTemplatePayload, unknown>;
	onTemplateCreated: (templateId: string) => void;
	products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
	galleryImages?: string[];
	allowedContexts?: string[];
	dynamicSources?: DynamicSourceField[];
	onProgress?: (progress: { stage: string; blocksAdded: number; totalBlocks: number }) => void;
};

type ImageUpload = {
	id: string;
	url: string;
	purpose: "reference" | "use-in-template";
	description?: string;
	file?: File;
	preview?: string;
};

export function AIEmailBuilderDialog({
	open,
	onOpenChange,
	currentOrg,
	templates,
	generateTemplate,
	onTemplateCreated,
	products = [],
	galleryImages = [],
	allowedContexts = [],
	dynamicSources = [],
}: AIEmailBuilderDialogProps) {
	const { t } = useTranslation();
	const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional">("modern");
	const [aiPrompt, setAiPrompt] = useState("");
	const [targetSection, setTargetSection] = useState<"header" | "body" | "footer" | "full">("full");
	const [generateCustomHtml, setGenerateCustomHtml] = useState(false);
	const [uploadedImages, setUploadedImages] = useState<ImageUpload[]>([]);
	const [selectedGalleryImages, setSelectedGalleryImages] = useState<string[]>([]);
	const [selectedLogo, setSelectedLogo] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Initialize logo from organization settings
	const organizationLogo = currentOrg?.settings?.branding?.customLogo || currentOrg?.logoUrl || null;
	
	// Set default logo when dialog opens or org changes
	useEffect(() => {
		if (open && organizationLogo && !selectedLogo) {
			setSelectedLogo(organizationLogo);
		}
	}, [open, organizationLogo, selectedLogo]);

	const handleImageUpload = useCallback(async (files: FileList | null) => {
		if (!files || files.length === 0 || !currentOrg) return;

		const newImages: ImageUpload[] = [];
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (!file.type.startsWith("image/")) {
				toast.error(t("emailDesigner.aiBuilder.invalidImageType"));
				continue;
			}

			// Create preview
			const preview = URL.createObjectURL(file);
			const imageUpload: ImageUpload = {
				id: crypto.randomUUID(),
				url: "",
				purpose: "reference",
				file,
				preview,
			};
			newImages.push(imageUpload);
		}

		setUploadedImages((prev) => [...prev, ...newImages]);

		// Upload images
		for (const imageUpload of newImages) {
			if (imageUpload.file) {
				try {
					const reader = new FileReader();
					reader.onload = async (e) => {
						const base64 = e.target?.result as string;
						const base64Data = base64.split(",")[1];
						
						try {
							const result = await functionsService.uploadFile({
								organizationId: currentOrg.id,
								fileName: imageUpload.file!.name,
								fileData: base64Data,
								contentType: imageUpload.file!.type,
								path: "email-ai-images",
							});

							setUploadedImages((prev) =>
								prev.map((img) =>
									img.id === imageUpload.id
										? { ...img, url: result.url, preview: undefined }
										: img
								)
							);
						} catch (error) {
							console.error("Failed to upload image:", error);
							toast.error(t("emailDesigner.aiBuilder.imageUploadFailed"));
							setUploadedImages((prev) => prev.filter((img) => img.id !== imageUpload.id));
						}
					};
					reader.readAsDataURL(imageUpload.file);
				} catch (error) {
					console.error("Failed to read image:", error);
					setUploadedImages((prev) => prev.filter((img) => img.id !== imageUpload.id));
				}
			}
		}
	}, [currentOrg, t]);

	const handleRemoveImage = (id: string) => {
		setUploadedImages((prev) => {
			const img = prev.find((i) => i.id === id);
			if (img?.preview) {
				URL.revokeObjectURL(img.preview);
			}
			return prev.filter((i) => i.id !== id);
		});
	};

	const handleToggleGalleryImage = (imageUrl: string) => {
		setSelectedGalleryImages((prev) =>
			prev.includes(imageUrl)
				? prev.filter((url) => url !== imageUrl)
				: [...prev, imageUrl]
		);
	};

	const handleGenerate = async () => {
		if (!currentOrg) {
			toast.error(t("emailDesigner.aiBuilder.orgNotFound"));
			return;
		}

		// Wait for all images to upload
		const pendingImages = uploadedImages.filter((img) => !img.url);
		if (pendingImages.length > 0) {
			toast.info(t("emailDesigner.aiBuilder.uploadingImages"));
			// Wait a bit for uploads to complete
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		try {
			// Build images array - only include selected logo if it's selected
			const allImages = [
				// Include selected logo if it exists and is selected
				...(selectedLogo ? [{
					url: selectedLogo,
					purpose: "use-in-template" as const,
					description: "Organization logo",
				}] : []),
				// Include uploaded images
				...uploadedImages
					.filter((img) => img.url)
					.map((img) => ({
						url: img.url,
						purpose: img.purpose,
						description: img.description,
					})),
				// Include selected gallery images (excluding logo if it's already included)
				...selectedGalleryImages
					.filter((url) => url !== selectedLogo) // Don't duplicate logo
					.map((url) => ({
						url,
						purpose: "use-in-template" as const,
					})),
			];

			const generatedTemplate = await generateTemplate.mutateAsync({
				organizationId: currentOrg.id,
				options: {
					style: aiStyle,
					customPrompt: aiPrompt.trim() || undefined,
					images: allImages.length > 0 ? allImages : undefined,
					context: {
						products: products.length > 0 ? products : undefined,
						organizationName: currentOrg.name,
						organizationSettings: currentOrg.settings,
						// DO NOT pass galleryImages - AI should only use explicitly selected images
					},
					allowedContexts: allowedContexts.length > 0 ? allowedContexts : undefined,
					dynamicSources:
						dynamicSources.length > 0
							? dynamicSources.map((source) => ({
									placeholderKey: source.placeholderKey,
									entity: source.entity,
									path: source.path,
									label: source.label,
									description: source.description,
									valueType: source.valueType,
									required: source.required,
									sourceKind: source.sourceKind,
							  }))
							: undefined,
					generateCustomHtml,
					targetSection,
				},
			});

			const baseName = generatedTemplate.name || t("emailDesigner.aiBuilder.defaultName");
			// Generate unique name by checking existing email template names
			const existingNames = new Set(templates.map((t) => t.name?.toLowerCase().trim() || ""));
			let uniqueName = baseName;
			if (existingNames.has(baseName.toLowerCase().trim())) {
				let counter = 1;
				do {
					uniqueName = `${baseName} (${counter})`;
					counter++;
				} while (existingNames.has(uniqueName.toLowerCase().trim()));
			}
			
			const templateWithUniqueName: EmailTemplateData = {
				...generatedTemplate,
				name: uniqueName,
			};

			const templateId = await emailTemplateService.createDraft(templateWithUniqueName);
			onTemplateCreated(templateId);
			onOpenChange(false);
			setAiPrompt("");
			setUploadedImages([]);
			setSelectedGalleryImages([]);
			toast.success(t("emailDesigner.aiBuilder.generateSuccess"));
		} catch (error) {
			toast.error(
				t("emailDesigner.aiBuilder.generateFailed", {
					error: error instanceof Error ? error.message : "Unknown error",
				})
			);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				onOpenChange(open);
				if (!open) {
					setAiPrompt("");
					setUploadedImages([]);
					setSelectedGalleryImages([]);
					setSelectedLogo(null);
				}
			}}
		>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-purple-500" />
						{t("emailDesigner.aiBuilder.title")}
					</DialogTitle>
					<DialogDescription>
						{t("emailDesigner.aiBuilder.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>{t("emailDesigner.aiBuilder.style")}</Label>
						<Select
							value={aiStyle}
							onValueChange={(v) => setAiStyle(v as typeof aiStyle)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="modern">{t("emailDesigner.aiBuilder.modern")}</SelectItem>
								<SelectItem value="classic">{t("emailDesigner.aiBuilder.classic")}</SelectItem>
								<SelectItem value="minimal">{t("emailDesigner.aiBuilder.minimal")}</SelectItem>
								<SelectItem value="professional">{t("emailDesigner.aiBuilder.professional")}</SelectItem>
								<SelectItem value="newsletter">{t("emailDesigner.aiBuilder.newsletter")}</SelectItem>
								<SelectItem value="transactional">{t("emailDesigner.aiBuilder.transactional")}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>{t("emailDesigner.aiBuilder.targetSection")}</Label>
						<Select
							value={targetSection}
							onValueChange={(v) => setTargetSection(v as typeof targetSection)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="full">{t("emailDesigner.aiBuilder.fullTemplate")}</SelectItem>
								<SelectItem value="header">{t("emailDesigner.sections.header")}</SelectItem>
								<SelectItem value="body">{t("emailDesigner.sections.body")}</SelectItem>
								<SelectItem value="footer">{t("emailDesigner.sections.footer")}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="ai-prompt">{t("emailDesigner.aiBuilder.instructions")}</Label>
						<Textarea
							id="ai-prompt"
							placeholder={t("emailDesigner.aiBuilder.instructionsPlaceholder")}
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							className="min-h-[100px] resize-none"
							rows={4}
						/>
						<p className="text-xs text-muted-foreground">
							{t("emailDesigner.aiBuilder.instructionsHint")}
						</p>
					</div>

					{/* Logo Section */}
					<div className="space-y-2">
						<Label>{t("emailDesigner.aiBuilder.logo")}</Label>
						<p className="text-xs text-muted-foreground">
							{t("emailDesigner.aiBuilder.logoDescription")}
						</p>
						{organizationLogo && (
							<div className="space-y-2">
								<div className="flex items-center gap-2">
									<div className="relative border-2 rounded-lg overflow-hidden flex-1">
										<img
											src={selectedLogo || organizationLogo}
											alt="Logo"
											className="w-full h-20 object-contain bg-muted"
										/>
										{selectedLogo === organizationLogo && (
											<div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
												{t("emailDesigner.aiBuilder.default")}
											</div>
										)}
									</div>
								</div>
								{galleryImages.length > 0 && (
									<div className="space-y-1">
										<Label className="text-xs">{t("emailDesigner.aiBuilder.selectDifferent")}</Label>
										<div className="grid grid-cols-3 gap-2">
											{galleryImages.map((url) => (
												<button
													key={url}
													type="button"
													onClick={() => setSelectedLogo(url)}
													className={cn(
														"relative border-2 rounded-lg overflow-hidden transition-all",
														selectedLogo === url
															? "border-primary ring-2 ring-primary ring-offset-1"
															: "border-muted hover:border-primary/50"
													)}
												>
													<img
														src={url}
														alt="Gallery"
														className="w-full h-16 object-cover"
													/>
													{selectedLogo === url && (
														<div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
															<div className="bg-primary text-primary-foreground rounded-full p-1">
																<ImageIcon className="h-3 w-3" />
															</div>
														</div>
													)}
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						)}
						{!organizationLogo && (
							<p className="text-xs text-muted-foreground italic">
								{t("emailDesigner.aiBuilder.noLogo")}
							</p>
						)}
					</div>

					{/* Image Upload Section */}
					<div className="space-y-2">
						<Label>{t("emailDesigner.aiBuilder.images")}</Label>
						<div className="space-y-2">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								multiple
								className="hidden"
								onChange={(e) => handleImageUpload(e.target.files)}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => fileInputRef.current?.click()}
								className="w-full"
							>
								<Upload className="h-4 w-4 mr-2" />
								{t("emailDesigner.aiBuilder.uploadImages")}
							</Button>

							{uploadedImages.length > 0 && (
								<div className="grid grid-cols-2 gap-2">
									{uploadedImages.map((img) => (
										<div
											key={img.id}
											className="relative border rounded-lg overflow-hidden group"
										>
											{img.preview || img.url ? (
												<img
													src={img.preview || img.url}
													alt="Upload"
													className="w-full h-24 object-cover"
												/>
											) : (
												<div className="w-full h-24 bg-muted flex items-center justify-center">
													<Loader2 className="h-4 w-4 animate-spin" />
												</div>
											)}
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={() => handleRemoveImage(img.id)}
											>
												<X className="h-3 w-3" />
											</Button>
											<Select
												value={img.purpose}
												onValueChange={(v) => {
													setUploadedImages((prev) =>
														prev.map((i) =>
															i.id === img.id
																? { ...i, purpose: v as "reference" | "use-in-template" }
																: i
														)
													);
												}}
											>
												<SelectTrigger className="absolute bottom-1 left-1 right-1 h-6 text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="reference">
														{t("emailDesigner.aiBuilder.imageReference")}
													</SelectItem>
													<SelectItem value="use-in-template">
														{t("emailDesigner.aiBuilder.imageUseInTemplate")}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Gallery Images */}
					{galleryImages.length > 0 && (
						<div className="space-y-2">
							<Label>{t("emailDesigner.aiBuilder.galleryImages")}</Label>
							<div className="grid grid-cols-3 gap-2">
								{galleryImages.map((url) => (
									<button
										key={url}
										type="button"
										onClick={() => handleToggleGalleryImage(url)}
										className={cn(
											"relative border-2 rounded-lg overflow-hidden transition-all",
											selectedGalleryImages.includes(url)
												? "border-primary ring-2 ring-primary ring-offset-1"
												: "border-muted"
										)}
									>
										<img
											src={url}
											alt="Gallery"
											className="w-full h-20 object-cover"
										/>
										{selectedGalleryImages.includes(url) && (
											<div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
												<div className="bg-primary text-primary-foreground rounded-full p-1">
													<ImageIcon className="h-3 w-3" />
												</div>
											</div>
										)}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="flex items-center justify-between">
						<Label htmlFor="generate-custom-html">
							{t("emailDesigner.aiBuilder.generateCustomHtml")}
						</Label>
						<input
							id="generate-custom-html"
							type="checkbox"
							checked={generateCustomHtml}
							onChange={(e) => setGenerateCustomHtml(e.target.checked)}
							className="h-4 w-4 rounded border-gray-300"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={generateTemplate.isPending}
					>
						{t("emailDesigner.aiBuilder.cancel")}
					</Button>
					<Button
						onClick={handleGenerate}
						disabled={generateTemplate.isPending || !currentOrg}
						className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
					>
						{generateTemplate.isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{t("emailDesigner.aiBuilder.generating")}
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								{t("emailDesigner.aiBuilder.generate")}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

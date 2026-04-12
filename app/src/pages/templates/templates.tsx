import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import {
	Plus,
	Trash2,
	Edit,
	FileText,
	Calendar,
	Loader2,
	Mail,
	Upload,
	Sparkles,
	Download,
	Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useDeleteTemplate } from "@/hooks/repository-hooks/use-delete-template";
import { useBulkDeleteTemplates } from "@/hooks/repository-hooks/use-bulk-delete-templates";
import { useDeleteEmailTemplate } from "@/hooks/repository-hooks/use-delete-email-template";
import { useBulkDeleteEmailTemplates } from "@/hooks/repository-hooks/use-bulk-delete-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useCreateEmailTemplate } from "@/hooks/repository-hooks/use-create-email-template";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { TemplateCardPreview } from "@/components/templates/template-card-preview";
import { EmailTemplateCardPreview } from "@/components/templates/email-template-card-preview";
import { CreateEmailTemplateDialog } from "@/components/email-designer/create-email-template-dialog";
import type { Template } from "@/core/entities/template";
import type { EmailTemplate, EmailTemplateBlock } from "@/core/entities/email-template";
import {
	EMAIL_TEMPLATE_TYPE_DEFINITIONS,
	allowedContextsForTemplateType,
	inferTemplateTypeFromAllowedContexts,
	type EmailTemplateTypeId,
} from "@/utils/email-template-compatibility";

export default function TemplatesPage() {
	const { t } = useTranslation();
	const { formatDateTable } = useDateFormatting();
	const navigate = useNavigate();
	const { data: currentOrganization } = useCurrentOrganization();
	const { data: templates, isLoading } = useTemplates(
		currentOrganization?.id,
	);
	const { data: emailTemplates = [], isLoading: isLoadingEmailTemplates } =
		useEmailTemplates(currentOrganization?.id);
	const deleteTemplate = useDeleteTemplate(currentOrganization?.id);
	const bulkDeleteTemplates = useBulkDeleteTemplates(currentOrganization?.id);
	const deleteEmailTemplate = useDeleteEmailTemplate(currentOrganization?.id);
	const bulkDeleteEmailTemplates = useBulkDeleteEmailTemplates(
		currentOrganization?.id,
	);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [templateToDelete, setTemplateToDelete] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
		new Set(),
	);
	const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
	const [selectedEmailTemplateIds, setSelectedEmailTemplateIds] = useState<
		Set<string>
	>(new Set());
	const [deleteEmailDialogOpen, setDeleteEmailDialogOpen] = useState(false);
	const [emailTemplateToDelete, setEmailTemplateToDelete] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [bulkDeleteEmailDialogOpen, setBulkDeleteEmailDialogOpen] =
		useState(false);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [createEmailDialogOpen, setCreateEmailDialogOpen] = useState(false);
	const [selectedTemplateType, setSelectedTemplateType] = useState<EmailTemplateTypeId>("all");
	const createEmailTemplate = useCreateEmailTemplate();

	const handleDelete = (template: { id: string; name: string }) => {
		setTemplateToDelete(template);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		if (!templateToDelete) return;

		try {
			await deleteTemplate.mutateAsync(templateToDelete.id);
			setDeleteDialogOpen(false);
			setTemplateToDelete(null);
		} catch {
			// Error is handled by the mutation
		}
	};

	const handleDeleteEmail = (template: { id: string; name: string }) => {
		setEmailTemplateToDelete(template);
		setDeleteEmailDialogOpen(true);
	};

	const confirmDeleteEmail = async () => {
		if (!emailTemplateToDelete) return;

		try {
			await deleteEmailTemplate.mutateAsync(emailTemplateToDelete.id);
			setSelectedEmailTemplateIds((prev) => {
				const next = new Set(prev);
				next.delete(emailTemplateToDelete.id);
				return next;
			});
			setDeleteEmailDialogOpen(false);
			setEmailTemplateToDelete(null);
		} catch {
			setDeleteEmailDialogOpen(false);
		}
	};

	const handleCreateInvoiceTemplate = () => {
		navigate("/designer");
	};

	const handleCreateEmailTemplate = () => {
		setSelectedTemplateType("all");
		setCreateEmailDialogOpen(true);
	};

	const handleConfirmCreateEmailTemplate = async () => {
		if (!currentOrganization?.id) return;
		const allowedContexts = allowedContextsForTemplateType(selectedTemplateType);
		const includeSmartPaymentBlock =
			allowedContexts.includes("invoice_send") || selectedTemplateType === "invoice";
		const defaultBlocks: EmailTemplateBlock[] = includeSmartPaymentBlock
			? [
					{
						id: crypto.randomUUID(),
						type: "paymentInstructions",
						section: "body",
						ctaLabel: "Pay now",
						fallbackMode: "bank_transfer",
						showReference: true,
						backgroundColor: "#f8fafc",
						border: {
							borderWidth: 1,
							borderColor: "#e2e8f0",
							borderStyle: "solid",
							borderRadius: 10,
						},
						spacing: {
							paddingTop: 12,
							paddingRight: 12,
							paddingBottom: 12,
							paddingLeft: 12,
							marginTop: 8,
							marginRight: 0,
							marginBottom: 8,
							marginLeft: 0,
						},
					},
				]
			: [];
		try {
			const newTemplateId = await createEmailTemplate.mutateAsync({
				orgId: currentOrganization.id,
				name: `New Email Template ${emailTemplates.length + 1}`,
				subject: "",
				preheader: "",
				status: "draft",
				version: 1,
				isLocked: false,
				isSystemDefault: false,
				allowedContexts,
				htmlContent: "",
				blocks: defaultBlocks,
				designTokens: {
					background: "#ffffff",
					surface: "#f8fafc",
					text: "#0f172a",
					primary: "#2563eb",
					fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
					borderRadius: 12,
				},
				placeholders: [],
			});
			setCreateEmailDialogOpen(false);
			navigate(`/email-designer/${newTemplateId}`);
		} catch {
			// Error handled by mutation
		}
	};

	const handleUploadInvoice = () => {
		navigate("/invoice-upload-flow", {
			state: { flowType: "template", returnTo: "/templates" },
		});
	};

	const handleOpenEmailTemplate = (templateId: string) => {
		navigate(`/email-designer/${templateId}`);
	};

	const handleEdit = (templateId: string) => {
		navigate(`/designer/${templateId}`);
	};

	// Selection handlers
	const handleToggleSelect = (templateId: string) => {
		setSelectedTemplateIds((prev) => {
			const next = new Set(prev);
			if (next.has(templateId)) {
				next.delete(templateId);
			} else {
				next.add(templateId);
			}
			return next;
		});
	};

	const handleSelectAll = () => {
		if (!templates) return;
		if (selectedTemplateIds.size === templates.length) {
			// Deselect all
			setSelectedTemplateIds(new Set());
		} else {
			// Select all
			setSelectedTemplateIds(new Set(templates.map((t) => t.id)));
		}
	};

	const handleEmailToggleSelect = (templateId: string) => {
		setSelectedEmailTemplateIds((prev) => {
			const next = new Set(prev);
			if (next.has(templateId)) {
				next.delete(templateId);
			} else {
				next.add(templateId);
			}
			return next;
		});
	};

	const handleEmailSelectAll = () => {
		if (emailTemplates.length === 0) return;
		if (selectedEmailTemplateIds.size === emailTemplates.length) {
			setSelectedEmailTemplateIds(new Set());
		} else {
			setSelectedEmailTemplateIds(
				new Set(emailTemplates.map((t) => t.id)),
			);
		}
	};

	const handleBulkDelete = () => {
		setBulkDeleteDialogOpen(true);
	};

	const confirmBulkDelete = async () => {
		if (selectedTemplateIds.size === 0) return;

		const templateIds = Array.from(selectedTemplateIds);

		try {
			// Delete all selected templates in parallel
			await bulkDeleteTemplates.mutateAsync(templateIds);

			setBulkDeleteDialogOpen(false);
			setSelectedTemplateIds(new Set());
			toast.success(
				templateIds.length === 1
					? t("templates.bulkDelete.success", {
							count: templateIds.length,
						}) ||
							`Successfully deleted ${templateIds.length} template`
					: t("templates.bulkDelete.success_plural", {
							count: templateIds.length,
						}) ||
							`Successfully deleted ${templateIds.length} templates`,
			);
		} catch {
			// Error is handled by the mutation
			setBulkDeleteDialogOpen(false);
		}
	};

	const handleEmailBulkDelete = () => {
		setBulkDeleteEmailDialogOpen(true);
	};

	const confirmBulkDeleteEmail = async () => {
		if (selectedEmailTemplateIds.size === 0) return;

		const templateIds = Array.from(selectedEmailTemplateIds);

		try {
			await bulkDeleteEmailTemplates.mutateAsync(templateIds);
			setBulkDeleteEmailDialogOpen(false);
			setSelectedEmailTemplateIds(new Set());
			toast.success(
				templateIds.length === 1
					? t("templates.bulkDelete.success", {
							count: templateIds.length,
						}) ||
							`Successfully deleted ${templateIds.length} template`
					: t("templates.bulkDelete.success_plural", {
							count: templateIds.length,
						}) ||
							`Successfully deleted ${templateIds.length} templates`,
			);
		} catch {
			setBulkDeleteEmailDialogOpen(false);
		}
	};

	// Computed values
	const allSelected = useMemo(() => {
		return (
			templates &&
			templates.length > 0 &&
			selectedTemplateIds.size === templates.length
		);
	}, [templates, selectedTemplateIds]);

	const allEmailSelected = useMemo(() => {
		return (
			emailTemplates &&
			emailTemplates.length > 0 &&
			selectedEmailTemplateIds.size === emailTemplates.length
		);
	}, [emailTemplates, selectedEmailTemplateIds]);

	if (isLoading) {
		return (
			<div className="py-6 pr-6 space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-48" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="py-6 pr-6 space-y-4 sm:space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{t("templates.title")}
					</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						{t("templates.subtitle")}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						onClick={() => navigate("/marketplace")}
					>
						<Store className="mr-2 h-4 w-4" />
						{t("templates.browseMarketplace") ||
							"Browse Marketplace"}
					</Button>
					<Button
						variant="outline"
						onClick={() => setShowExportDialog(true)}
					>
						<Download className="mr-2 h-4 w-4" />
						Export
					</Button>
					{selectedTemplateIds.size > 0 && (
						<>
							<Button
								variant="destructive"
								onClick={handleBulkDelete}
								disabled={bulkDeleteTemplates.isPending}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								{t("templates.bulkDelete.delete", {
									count: selectedTemplateIds.size,
								}) ||
									`Delete ${selectedTemplateIds.size} selected`}
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									setSelectedTemplateIds(new Set())
								}
							>
								{t("templates.bulkDelete.clear") ||
									"Clear selection"}
							</Button>
						</>
					)}
					{selectedEmailTemplateIds.size > 0 && (
						<>
							<Button
								variant="destructive"
								onClick={handleEmailBulkDelete}
								disabled={bulkDeleteEmailTemplates.isPending}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								{t("templates.bulkDelete.delete", {
									count: selectedEmailTemplateIds.size,
								}) ||
									`Delete ${selectedEmailTemplateIds.size} selected`}
							</Button>
							<Button
								variant="outline"
								onClick={() =>
									setSelectedEmailTemplateIds(new Set())
								}
							>
								{t("templates.bulkDelete.clear") ||
									"Clear selection"}
							</Button>
						</>
					)}
					<Button onClick={handleCreateInvoiceTemplate}>
						<Plus className="h-4 w-4 mr-2" />
						{t("templates.actions.createInvoice")}
					</Button>
					<Button variant="outline" onClick={handleUploadInvoice}>
						<Upload className="h-4 w-4 mr-2" />
						<Sparkles className="h-3 w-3 mr-1" />
						Generate from Invoice
					</Button>
					<Button
						variant="secondary"
						onClick={handleCreateEmailTemplate}
					>
						<Mail className="h-4 w-4 mr-2" />
						{t("templates.actions.createEmail")}
					</Button>
				</div>
			</div>

			<section className="space-y-6">
				<div className="flex items-center justify-between border-b pb-4">
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<FileText className="h-5 w-5 text-primary" />
							</div>
							<div>
								<h2 className="text-2xl font-bold tracking-tight text-foreground">
									{t("templates.sections.invoice.title")}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t(
										"templates.sections.invoice.description",
									)}
								</p>
							</div>
						</div>
					</div>
					{templates && templates.length > 0 && (
						<div className="text-sm text-muted-foreground">
							{templates.length}{" "}
							{templates.length === 1 ? "template" : "templates"}
						</div>
					)}
				</div>

				{/* Selection Controls */}
				{templates && templates.length > 0 && (
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<Checkbox
								checked={allSelected}
								onCheckedChange={handleSelectAll}
								aria-label={
									allSelected ? "Deselect all" : "Select all"
								}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSelectAll}
								className="h-auto p-0 font-normal text-foreground"
							>
								{allSelected
									? t("templates.bulkDelete.deselectAll") ||
										"Deselect all"
									: t("templates.bulkDelete.selectAll") ||
										"Select all"}
							</Button>
						</div>
						{selectedTemplateIds.size > 0 && (
							<span className="text-sm text-muted-foreground">
								{t("templates.bulkDelete.selectedCount", {
									count: selectedTemplateIds.size,
								})}
							</span>
						)}
					</div>
				)}

				{/* Templates Grid */}
				{!templates || templates.length === 0 ? (
					<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
						<Card className="border-2 border-dashed">
							<CardContent className="flex flex-col items-center justify-center py-12">
								<FileText className="h-16 w-16 text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold mb-2 text-foreground">
									{t("templates.empty.title")}
								</h3>
								<p className="text-muted-foreground mb-6 text-center max-w-md">
									{t("templates.empty.description")}
								</p>
								<Button onClick={handleCreateInvoiceTemplate}>
									<Plus className="h-4 w-4 mr-2" />
									{t("templates.empty.createFirst")}
								</Button>
							</CardContent>
						</Card>
						<Card className="border-primary/20 bg-primary/5">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Sparkles className="h-5 w-5 text-primary" />
									{t("templates.aiUpload.title")}
								</CardTitle>
								<CardDescription>
									{t("templates.aiUpload.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<ul className="text-sm text-muted-foreground space-y-2">
									<li className="flex items-start gap-2">
										<span className="text-primary mt-0.5">
											•
										</span>
										<span>{t("templates.aiUpload.points.upload")}</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-primary mt-0.5">
											•
										</span>
										<span>{t("templates.aiUpload.points.extract")}</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-primary mt-0.5">
											•
										</span>
										<span>{t("templates.aiUpload.points.generate")}</span>
									</li>
								</ul>
								<Button
									onClick={handleUploadInvoice}
									className="w-full"
								>
									<Upload className="h-4 w-4 mr-2" />
									{t("templates.aiUpload.button")}
								</Button>
							</CardContent>
						</Card>
					</div>
				) : (
					<>
						{/* AI Template Generation Banner */}
						<div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border border-primary/20 mb-6">
							<div className="relative px-6 py-5">
								<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
									<div className="flex-1 space-y-1.5">
										<h3 className="font-semibold text-base text-foreground">
											{t("templates.aiUpload.bannerTitle")}{" "}
											<span className="font-normal text-muted-foreground">
												{t("templates.aiUpload.bannerDescription")}
											</span>
										</h3>
									</div>
									<Button
										onClick={handleUploadInvoice}
										size="lg"
										className="font-medium shadow-sm whitespace-nowrap"
									>
										<Upload className="h-4 w-4 mr-2" />
										{t("templates.aiUpload.button")}
									</Button>
								</div>
							</div>
						</div>
						<div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
							{templates.map((template) => {
								const isSelected = selectedTemplateIds.has(
									template.id,
								);
								return (
									<Card
										key={template.id}
										className={`flex flex-col h-full w-full hover:shadow-lg transition-all cursor-pointer group overflow-hidden py-0 gap-0 ${
											isSelected
												? "ring-2 ring-primary"
												: ""
										}`}
										onClick={(e) => {
											// Don't navigate if clicking on checkbox or action buttons
											const target =
												e.target as HTMLElement;
											if (
												target.closest("button") ||
												target.closest(
													'[role="checkbox"]',
												) ||
												target.closest(
													'input[type="checkbox"]',
												)
											) {
												return;
											}
											handleEdit(template.id);
										}}
									>
										{/* Template Preview */}
										<div className="relative w-full h-48 bg-muted/30 overflow-hidden border-b">
											<div className="absolute inset-0 pointer-events-none overflow-hidden">
												<TemplateCardPreview
													template={
														template as Template
													}
												/>
											</div>
											{/* Overlay buttons */}
											<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
												<Button
													variant="secondary"
													size="icon"
													className="h-8 w-8 shrink-0 bg-background/95 backdrop-blur-sm"
													onClick={(e) => {
														e.stopPropagation();
														handleEdit(template.id);
													}}
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="secondary"
													size="icon"
													className="h-8 w-8 shrink-0 text-destructive hover:text-destructive bg-background/95 backdrop-blur-sm"
													onClick={(e) => {
														e.stopPropagation();
														handleDelete({
															id: template.id,
															name:
																template.name ||
																t(
																	"templates.card.untitled",
																),
														});
													}}
													disabled={
														deleteTemplate.isPending
													}
												>
													{deleteTemplate.isPending &&
													templateToDelete?.id ===
														template.id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Trash2 className="h-4 w-4" />
													)}
												</Button>
											</div>
											{/* Checkbox overlay */}
											<div className="absolute top-2 left-2 z-10">
												<Checkbox
													checked={isSelected}
													onCheckedChange={() =>
														handleToggleSelect(
															template.id,
														)
													}
													onClick={(e) =>
														e.stopPropagation()
													}
													aria-label={`Select ${template.name || t("templates.card.untitled")}`}
													className="h-5 w-5 bg-background/95 backdrop-blur-sm border-2"
												/>
											</div>
										</div>

										{/* Card Content */}
										<CardContent className="flex-1 flex flex-col p-4 w-full">
											<div className="space-y-3 w-full">
												{/* Title and Description */}
												<div className="space-y-1">
													<h3
														className="font-semibold text-base leading-tight line-clamp-1"
														title={
															template.name ||
															t(
																"templates.card.untitled",
															)
														}
													>
														{template.name ||
															t(
																"templates.card.untitled",
															)}
													</h3>
													{template.description && (
														<p
															className="text-xs text-muted-foreground line-clamp-2"
															title={
																template.description
															}
														>
															{
																template.description
															}
														</p>
													)}
												</div>

												{/* Status and Region Badges */}
												<div className="flex items-center gap-2 justify-between">
													<div className="flex gap-2 items-center">
														<Badge
															variant={
																template.status ===
																"published"
																	? "default"
																	: "secondary"
															}
															className="text-xs"
														>
															{template.status ===
															"published"
																? t(
																		"templates.card.published",
																	)
																: t(
																		"templates.card.draft",
																	)}
														</Badge>

														{template.compliance
															?.region && (
															<Badge
																variant="outline"
																className="text-xs"
																title={
																	template
																		.compliance
																		.region
																}
															>
																{
																	template
																		.compliance
																		.region
																}
															</Badge>
														)}
													</div>
													<div className="flex items-center gap-3 text-xs text-muted-foreground">
														{template.createdAt && (
															<div className="flex items-center gap-1">
																<Calendar className="h-3 w-3" />
																<span>
																	{formatDateTable(
																		template.createdAt,
																	)}
																</span>
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</>
				)}
			</section>

			{/* Visual Separator */}
			<div className="relative py-8">
				<div className="absolute inset-0 flex items-center">
					<div className="w-full border-t border-border"></div>
				</div>
			</div>

			<section className="space-y-6">
				<div className="flex items-center justify-between border-b pb-4">
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
								<Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<h2 className="text-2xl font-bold tracking-tight text-foreground">
									{t("templates.sections.email.title")}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t("templates.sections.email.description")}
								</p>
							</div>
						</div>
					</div>
					{emailTemplates.length > 0 && (
						<div className="text-sm text-muted-foreground">
							{emailTemplates.length}{" "}
							{emailTemplates.length === 1
								? "template"
								: "templates"}
						</div>
					)}
				</div>

				{emailTemplates.length > 0 && (
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<Checkbox
								checked={allEmailSelected}
								onCheckedChange={handleEmailSelectAll}
								aria-label={
									allEmailSelected
										? "Deselect all email templates"
										: "Select all email templates"
								}
							/>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleEmailSelectAll}
								className="h-auto p-0 font-normal text-foreground"
							>
								{allEmailSelected
									? t("templates.bulkDelete.deselectAll") ||
										"Deselect all"
									: t("templates.bulkDelete.selectAll") ||
										"Select all"}
							</Button>
						</div>
						{selectedEmailTemplateIds.size > 0 && (
							<span className="text-sm text-muted-foreground">
								{selectedEmailTemplateIds.size}{" "}
								{selectedEmailTemplateIds.size === 1
									? "email template"
									: "email templates"}{" "}
								selected
							</span>
						)}
					</div>
				)}

				{isLoadingEmailTemplates ? (
					<div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
						{[1, 2, 3].map((item) => (
							<Card key={item}>
								<CardContent className="space-y-4 py-6">
									<Skeleton className="h-6 w-2/3" />
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-1/2" />
									<Skeleton className="h-10 w-full" />
								</CardContent>
							</Card>
						))}
					</div>
				) : emailTemplates.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12 text-center">
							<Mail className="h-14 w-14 text-muted-foreground mb-4" />
							<h3 className="text-lg font-semibold text-foreground mb-2">
								{t("templates.email.empty.title")}
							</h3>
							<p className="text-muted-foreground mb-6 max-w-md">
								{t("templates.email.empty.description")}
							</p>
							<Button
								variant="secondary"
								onClick={handleCreateEmailTemplate}
							>
								<Mail className="h-4 w-4 mr-2" />
								{t("templates.email.empty.createFirst")}
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
						{emailTemplates.map((template) => {
							const isSelected = selectedEmailTemplateIds.has(
								template.id,
							);
							const templateTypeId =
								inferTemplateTypeFromAllowedContexts(
									template.allowedContexts,
								);
							const templateTypeLabel =
								EMAIL_TEMPLATE_TYPE_DEFINITIONS.find(
									(type) => type.id === templateTypeId,
								)?.label ?? "All Compatible";
							return (
								<Card
									key={template.id}
                  className={`flex flex-col h-full w-full hover:shadow-lg transition-all cursor-pointer group overflow-hidden py-0 gap-0 ${
										isSelected ? "ring-2 ring-primary" : ""
									}`}
									onClick={(e) => {
										const target = e.target as HTMLElement;
										if (
											target.closest("button") ||
											target.closest(
												'[role="checkbox"]',
											) ||
											target.closest(
												'input[type="checkbox"]',
											)
										) {
											return;
										}
										handleOpenEmailTemplate(template.id);
									}}
								>
									{/* Email Template Preview */}
									<div className="relative w-full h-48 bg-muted/30 overflow-hidden border-b">
										<div className="absolute inset-0 pointer-events-none overflow-hidden">
											<EmailTemplateCardPreview
												template={
													template as EmailTemplate
												}
											/>
										</div>
										{/* Overlay buttons */}
										<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
											<Button
												variant="secondary"
												size="icon"
												className="h-8 w-8 shrink-0 bg-background/95 backdrop-blur-sm"
												onClick={(e) => {
													e.stopPropagation();
													handleOpenEmailTemplate(
														template.id,
													);
												}}
											>
												<Edit className="h-4 w-4" />
											</Button>
											<Button
												variant="secondary"
												size="icon"
												className="h-8 w-8 shrink-0 text-destructive hover:text-destructive bg-background/95 backdrop-blur-sm"
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteEmail({
														id: template.id,
														name:
															template.name ||
															t(
																"templates.email.card.untitled",
															),
													});
												}}
												disabled={
													deleteEmailTemplate.isPending
												}
											>
												{deleteEmailTemplate.isPending &&
												emailTemplateToDelete?.id ===
													template.id ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
										{/* Checkbox overlay */}
										<div className="absolute top-2 left-2 z-10">
											<Checkbox
												checked={isSelected}
												onCheckedChange={() =>
													handleEmailToggleSelect(
														template.id,
													)
												}
												onClick={(e) =>
													e.stopPropagation()
												}
												aria-label={`Select ${template.name || t("templates.email.card.untitled")}`}
												className="h-5 w-5 bg-background/95 backdrop-blur-sm border-2"
											/>
										</div>
									</div>

									{/* Card Content */}
									<CardContent className="flex-1 flex flex-col p-4 w-full">
										<div className="space-y-3 w-full">
											{/* Title and Description */}
											<div className="space-y-1">
												<h3
													className="font-semibold text-base leading-tight line-clamp-1"
													title={
														template.name ||
														t(
															"templates.email.card.untitled",
														)
													}
												>
													{template.name ||
														t(
															"templates.email.card.untitled",
														)}
												</h3>
												{template.subject && (
													<p
														className="text-xs text-muted-foreground line-clamp-2"
														title={template.subject}
													>
														{template.subject}
													</p>
												)}
											</div>

											{/* Status and Date */}
											<div className="flex items-center gap-2 justify-between">
												<div className="flex gap-2 items-center">
													<Badge
														variant={
															template.status ===
															"published"
																? "default"
																: "secondary"
														}
														className="text-xs"
													>
														{template.status ===
														"published"
															? t(
																	"templates.email.status.published",
																)
															: t(
																	"templates.email.status.draft",
																)}
													</Badge>
													<Badge
														variant="outline"
														className="text-xs"
													>
														{templateTypeLabel}
													</Badge>
												</div>
												<div className="flex items-center gap-3 text-xs text-muted-foreground">
													{(template.updatedAt ||
														template.createdAt) && (
														<div className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															<span>
																{formatDateTable(
																	template.updatedAt ||
																		template.createdAt ||
																		"",
																)}
															</span>
														</div>
													)}
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</section>

			{/* Single Delete Confirmation Dialog */}
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("templates.delete.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("templates.delete.description", {
								name: templateToDelete?.name || "",
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteTemplate.isPending}>
							{t("templates.delete.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDelete}
							disabled={deleteTemplate.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteTemplate.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("templates.delete.deleting")}
								</>
							) : (
								t("templates.delete.delete")
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Bulk Delete Confirmation Dialog */}
			<AlertDialog
				open={bulkDeleteDialogOpen}
				onOpenChange={setBulkDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{selectedTemplateIds.size === 1
								? t("templates.bulkDelete.title", {
										count: selectedTemplateIds.size,
									}) ||
									`Delete ${selectedTemplateIds.size} template?`
								: t("templates.bulkDelete.title_plural", {
										count: selectedTemplateIds.size,
									}) ||
									`Delete ${selectedTemplateIds.size} templates?`}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{selectedTemplateIds.size === 1
								? t("templates.bulkDelete.description", {
										count: selectedTemplateIds.size,
									}) ||
									`Are you sure you want to delete ${selectedTemplateIds.size} selected template? This action cannot be undone.`
								: t("templates.bulkDelete.description_plural", {
										count: selectedTemplateIds.size,
									}) ||
									`Are you sure you want to delete ${selectedTemplateIds.size} selected templates? This action cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={bulkDeleteTemplates.isPending}
						>
							{t("templates.delete.cancel") || "Cancel"}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmBulkDelete}
							disabled={bulkDeleteTemplates.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{bulkDeleteTemplates.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("templates.bulkDelete.deleting") ||
										"Deleting..."}
								</>
							) : selectedTemplateIds.size === 1 ? (
								t("templates.bulkDelete.confirm", {
									count: selectedTemplateIds.size,
								}) ||
								`Delete ${selectedTemplateIds.size} template`
							) : (
								t("templates.bulkDelete.confirm_plural", {
									count: selectedTemplateIds.size,
								}) ||
								`Delete ${selectedTemplateIds.size} templates`
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Email Delete Confirmation Dialog */}
			<AlertDialog
				open={deleteEmailDialogOpen}
				onOpenChange={setDeleteEmailDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("templates.delete.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("templates.delete.description", {
								name: emailTemplateToDelete?.name || "",
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={deleteEmailTemplate.isPending}
						>
							{t("templates.delete.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteEmail}
							disabled={deleteEmailTemplate.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteEmailTemplate.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("templates.delete.deleting")}
								</>
							) : (
								t("templates.delete.delete")
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Email Bulk Delete Confirmation Dialog */}
			<AlertDialog
				open={bulkDeleteEmailDialogOpen}
				onOpenChange={setBulkDeleteEmailDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{selectedEmailTemplateIds.size === 1
								? t("templates.bulkDelete.title", {
										count: selectedEmailTemplateIds.size,
									}) ||
									`Delete ${selectedEmailTemplateIds.size} template?`
								: t("templates.bulkDelete.title_plural", {
										count: selectedEmailTemplateIds.size,
									}) ||
									`Delete ${selectedEmailTemplateIds.size} templates?`}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{selectedEmailTemplateIds.size === 1
								? t("templates.bulkDelete.description", {
										count: selectedEmailTemplateIds.size,
									}) ||
									`Are you sure you want to delete ${selectedEmailTemplateIds.size} selected template? This action cannot be undone.`
								: t("templates.bulkDelete.description_plural", {
										count: selectedEmailTemplateIds.size,
									}) ||
									`Are you sure you want to delete ${selectedEmailTemplateIds.size} selected templates? This action cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={bulkDeleteEmailTemplates.isPending}
						>
							{t("templates.delete.cancel") || "Cancel"}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmBulkDeleteEmail}
							disabled={bulkDeleteEmailTemplates.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{bulkDeleteEmailTemplates.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("templates.bulkDelete.deleting") ||
										"Deleting..."}
								</>
							) : selectedEmailTemplateIds.size === 1 ? (
								t("templates.bulkDelete.confirm", {
									count: selectedEmailTemplateIds.size,
								}) ||
								`Delete ${selectedEmailTemplateIds.size} template`
							) : (
								t("templates.bulkDelete.confirm_plural", {
									count: selectedEmailTemplateIds.size,
								}) ||
								`Delete ${selectedEmailTemplateIds.size} templates`
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<ExportDialog
				open={showExportDialog}
				onOpenChange={setShowExportDialog}
				defaultEntityTypes={["templates"]}
			/>

			<CreateEmailTemplateDialog
				open={createEmailDialogOpen}
				isPending={createEmailTemplate.isPending}
				selectedTemplateType={selectedTemplateType}
				onSelectedTemplateTypeChange={setSelectedTemplateType}
				onOpenChange={(open) => {
					if (createEmailTemplate.isPending) return;
					setCreateEmailDialogOpen(open);
				}}
				onConfirm={handleConfirmCreateEmailTemplate}
				onCancel={() => setCreateEmailDialogOpen(false)}
			/>
		</div>
	);
}

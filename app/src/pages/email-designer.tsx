import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	Drawer,
	DrawerContent,
} from "@/components/ui/drawer";
import {
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Menu, Settings, Eye, Save, Loader2, Mail } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { EmailTemplate, EmailTemplateBlock, EmailSection } from "@/core";
import { emailTemplateService } from "@/services/email-template-service";
import { useCreateEmailTemplate } from "@/hooks/repository-hooks/use-create-email-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useEmailDesignerTemplate } from "@/contexts/email-designer-template-context";
import { EmailSidebar } from "@/components/email-designer/email-sidebar";
import { EmailCanvasHeader } from "@/components/email-designer/email-canvas-header";
import { EmailDesignerCanvas } from "@/components/email-designer/email-designer-canvas";
import { EmailBlockProperties } from "@/components/email-designer/email-block-properties";
import { EmailTemplateSettings } from "@/components/email-designer/email-template-settings";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresence } from "@/hooks/use-presence";

export default function EmailDesignerPage() {
	const { t } = useTranslation();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const queryClient = useQueryClient();
	const [selectedBlockId, setSelectedBlockId] = useState<string>();
	const [draftTemplate, setDraftTemplate] = useState<EmailTemplate | null>(null);
	const [currentSection, setCurrentSection] = useState<EmailSection>("body");
	const draftRef = useRef<EmailTemplate | null>(null);
	const currentTemplateRef = useRef<EmailTemplate | null>(null);
	const isCreatingTemplateRef = useRef<boolean>(false);
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const emailDesignerContext = useEmailDesignerTemplate();
	const createTemplate = useCreateEmailTemplate();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
	const [mobilePanelTab, setMobilePanelTab] = useState<"blocks" | "preview" | "properties">("blocks");
	
	// Use context values with safe defaults
	const safeTemplates = useMemo(() => {
		try {
			return emailDesignerContext?.templates ?? [];
		} catch (error) {
			console.error("Error accessing templates from context:", error);
			return [];
		}
	}, [emailDesignerContext?.templates]);
	const safeContextCurrentTemplateId = emailDesignerContext?.currentTemplateId;
	const safeSetContextCurrentTemplateId = emailDesignerContext?.setCurrentTemplateId ?? (() => {});
	const safeContextOnTemplateChange = emailDesignerContext?.onTemplateChange ?? (() => {});
	const safeContextHandleCreateNewTemplate = emailDesignerContext?.onCreateNewTemplate ?? (() => {});
	const isLoadingTemplates = emailDesignerContext?.isLoadingTemplates ?? true;
	const isSubscribed = emailDesignerContext?.isSubscribed ?? false;

	// Prevent body scroll when mobile panel is open
	useEffect(() => {
		if (isMobile && mobilePanelOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isMobile, mobilePanelOpen]);

	// Get base template from context (without draft state)
	const baseTemplate = useMemo(() => {
		const templateId = safeContextCurrentTemplateId;
		return safeTemplates.find((t: EmailTemplate) => t.id === templateId) ?? safeTemplates[0];
	}, [safeTemplates, safeContextCurrentTemplateId]);

	const { activeUsers } = usePresence(baseTemplate?.id);

	// Keep refs in sync for stable event handlers
	useEffect(() => {
		draftRef.current = draftTemplate;
	}, [draftTemplate]);

	useEffect(() => {
		currentTemplateRef.current = baseTemplate ?? null;
	}, [baseTemplate]);

	// Reset selection when template changes
	useEffect(() => {
		setSelectedBlockId(undefined);
	}, [safeContextCurrentTemplateId]);

	// Sync context currentTemplateId with URL
	useEffect(() => {
		if (templateIdFromUrl) {
			const templateExists = safeTemplates.some((t: EmailTemplate) => t.id === templateIdFromUrl);
			if (templateExists && safeContextCurrentTemplateId !== templateIdFromUrl) {
				safeSetContextCurrentTemplateId(templateIdFromUrl);
			} else if (!templateExists && safeTemplates.length > 0) {
				// Template not found, redirect to templates list
				// navigate("/templates");
			}
		} else if (
			!safeContextCurrentTemplateId && 
			!createTemplate.isPending && 
			!createTemplate.isSuccess &&
			!isCreatingTemplateRef.current &&
			safeTemplates.length === 0
		) {
			// No template ID in URL and no template selected - auto-create a new one
			isCreatingTemplateRef.current = true;
			const createPromise = safeContextHandleCreateNewTemplate();
			if (createPromise && typeof createPromise.then === 'function') {
				createPromise
					.then(() => {
						setTimeout(() => {
							isCreatingTemplateRef.current = false;
						}, 1000);
					})
					.catch(() => {
						isCreatingTemplateRef.current = false;
					});
			} else {
				setTimeout(() => {
					isCreatingTemplateRef.current = false;
				}, 2000);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [safeTemplates, safeContextCurrentTemplateId, templateIdFromUrl, createTemplate.isPending, createTemplate.isSuccess]);

	// Track previous base template ID to avoid infinite loops
	const previousBaseTemplateIdRef = useRef<string | undefined>(undefined);
	
	// Sync draft template with base template (only when base template ID changes)
	useEffect(() => {
		const baseTemplateId = baseTemplate?.id;
		if (baseTemplate && baseTemplateId !== previousBaseTemplateIdRef.current) {
			previousBaseTemplateIdRef.current = baseTemplateId;
			const cloned = JSON.parse(JSON.stringify(baseTemplate)) as EmailTemplate;
			// Ensure all blocks have a section field (default to "body" if missing)
			if (cloned.blocks && Array.isArray(cloned.blocks)) {
				cloned.blocks = cloned.blocks.map((block) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const typedBlock = block as any;
					if (!typedBlock.section) {
						// Auto-assign section based on block type
						const blockType = typedBlock.type as string;
						if (blockType === "subject" || blockType === "preheader" || blockType === "logo" || blockType === "navigation") {
							return Object.assign({}, typedBlock, { section: "header" as EmailSection });
						}
						if (blockType === "footerText" || blockType === "socialLinks" || blockType === "unsubscribe") {
							return Object.assign({}, typedBlock, { section: "footer" as EmailSection });
						}
						return Object.assign({}, typedBlock, { section: "body" as EmailSection });
					}
					return typedBlock;
				}) as EmailTemplateBlock[];
			}
			setDraftTemplate(cloned);
		} else if (!baseTemplate) {
			previousBaseTemplateIdRef.current = undefined;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [baseTemplate?.id]); // Only depend on the ID to prevent infinite loops

	const hasChanges = useMemo(() => {
		if (!draftTemplate || !baseTemplate) return false;
		return JSON.stringify(draftTemplate) !== JSON.stringify(baseTemplate);
	}, [draftTemplate, baseTemplate]);

	const saveMutation = useMutation({
		mutationFn: async (partial: Partial<EmailTemplate>) => {
			if (!baseTemplate) return;
			
			// Extract subject and preheader from blocks if they exist
			const blocks = partial.blocks ?? baseTemplate.blocks ?? [];
			const subjectBlock = blocks.find((b) => b.type === "subject");
			const preheaderBlock = blocks.find((b) => b.type === "preheader");
			
			// Use updateDraft for realtime database updates (same as invoice templates)
			await emailTemplateService.updateDraft(baseTemplate.id, {
				name: partial.name ?? baseTemplate.name,
				subject: subjectBlock?.content ?? partial.subject ?? baseTemplate.subject,
				preheader: preheaderBlock?.content ?? partial.preheader ?? baseTemplate.preheader,
				blocks: blocks,
				designTokens: partial.designTokens ?? baseTemplate.designTokens,
			});
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ["email-templates", orgId] });
			// Clear draft template after successful save (real-time update will handle it)
			setTimeout(() => setDraftTemplate(null), 100);
			toast.success(t("emailDesigner.toast.saved"));
		},
		onError: () => {
			toast.error(t("emailDesigner.toast.saveFailed"));
		},
	});

	const handleSave = async () => {
		if (!draftTemplate || !orgId) return;
		saveMutation.mutate(draftTemplate);
	};

	const handleDraftChange = (updates: Partial<EmailTemplate>) => {
		if (!draftTemplate) return;
		setDraftTemplate({ ...draftTemplate, ...updates });
	};

	const handleAddBlock = (type: EmailTemplateBlock["type"], section: EmailSection) => {
		if (!draftTemplate) return;
		const newBlock = createBlock(type, section);
		handleDraftChange({ blocks: [...draftTemplate.blocks, newBlock] });
		setSelectedBlockId(newBlock.id);
		if (isMobile) {
			setMobilePanelTab("properties");
			setMobilePanelOpen(true);
		}
	};

	const handleUpdateBlock = (blockId: string, updatedBlock: EmailTemplateBlock) => {
		if (!draftTemplate) return;
		const nextBlocks = draftTemplate.blocks.map((block) =>
			block.id === blockId ? updatedBlock : block,
		);
		
		// Sync subject/preheader blocks with template fields
		const updates: Partial<EmailTemplate> = { blocks: nextBlocks };
		if (updatedBlock.type === "subject") {
			updates.subject = updatedBlock.content;
		} else if (updatedBlock.type === "preheader") {
			updates.preheader = updatedBlock.content;
		}
		
		handleDraftChange(updates);
	};

	const handleAddNestedBlock = (parentBlockId: string, blockType: EmailTemplateBlock["type"], columnId?: string) => {
		if (!draftTemplate) return;
		const parentBlock = draftTemplate.blocks.find(b => b.id === parentBlockId);
		if (!parentBlock) return;

		const newBlock = createBlock(blockType, parentBlock.section || "body");
		
		if (parentBlock.type === "columns" && columnId) {
			const colsBlock = parentBlock as Extract<EmailTemplateBlock, { type: "columns" }>;
			const updatedColumns = colsBlock.columns.map(col => 
				col.id === columnId 
					? { ...col, blocks: [...(col.blocks || []), newBlock] }
					: col
			);
			handleUpdateBlock(parentBlockId, { ...parentBlock, columns: updatedColumns } as EmailTemplateBlock);
		} else if (parentBlock.type === "container") {
			const containerBlock = parentBlock as Extract<EmailTemplateBlock, { type: "container" }>;
			handleUpdateBlock(parentBlockId, { ...containerBlock, blocks: [...(containerBlock.blocks || []), newBlock] } as EmailTemplateBlock);
		}
		setSelectedBlockId(newBlock.id);
	};

	const handleDeleteBlock = (blockId: string) => {
		if (!draftTemplate) return;
		const nextBlocks = draftTemplate.blocks.filter((block) => block.id !== blockId);
		handleDraftChange({ blocks: nextBlocks });
		if (selectedBlockId === blockId) {
			setSelectedBlockId(undefined);
		}
	};

	const handleReorderBlocks = (fromIndex: number, toIndex: number) => {
		if (!draftTemplate) return;
		const blocks = [...(draftTemplate.blocks ?? [])];
		const [moved] = blocks.splice(fromIndex, 1);
		blocks.splice(toIndex, 0, moved);
		handleDraftChange({ blocks });
	};

	if (isLoadingTemplates) {
		return (
			<div className="p-6 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[600px] w-full" />
			</div>
		);
	}

	if (!emailDesignerContext) {
		console.error("EmailDesignerContext is null - this should not happen if wrapper is correct");
		return (
			<div className="p-6 space-y-4">
				<div className="text-destructive">
					<h2 className="text-xl font-bold">Context Error</h2>
					<p className="text-sm">Email designer context is not available. Please refresh the page.</p>
				</div>
			</div>
		);
	}

	if (!safeTemplates.length) {
		return (
			<div className="p-4 md:p-6 space-y-6">
				<div>
					<p className="text-sm text-muted-foreground">{t("emailDesigner.subtitle")}</p>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{t("emailDesigner.title")}
					</h1>
				</div>
				<Card className="border border-dashed">
					<CardContent className="py-12 flex flex-col items-center text-center space-y-4">
						<Mail className="h-12 w-12 text-muted-foreground" />
						<div className="space-y-2">
							<p className="text-xl font-semibold text-foreground">
								{t("emailDesigner.empty.title")}
							</p>
							<p className="text-muted-foreground max-w-md">
								{t("emailDesigner.empty.description")}
							</p>
						</div>
						<Button onClick={safeContextHandleCreateNewTemplate} disabled={createTemplate.isPending}>
							{createTemplate.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Mail className="h-4 w-4 mr-2" />
							)}
							{t("emailDesigner.empty.action")}
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!draftTemplate || !baseTemplate) {
		return (
			<div className="p-6 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[600px] w-full" />
			</div>
		);
	}

	const selectedBlock = (draftTemplate.blocks ?? []).find((block) => block.id === selectedBlockId);

	const sidebarContent = (
		<EmailSidebar
			templates={safeTemplates}
			currentTemplate={baseTemplate}
			onCreateNewTemplate={safeContextHandleCreateNewTemplate}
			isCreating={createTemplate.isPending}
			onAddBlock={handleAddBlock}
			blocks={draftTemplate.blocks ?? []}
			selectedBlockId={selectedBlockId}
			onSelectBlock={setSelectedBlockId}
			onReorderBlocks={handleReorderBlocks}
			currentSection={currentSection}
			onSectionChange={setCurrentSection}
		/>
	);

	const propertiesContent = (
		<div className="h-full flex flex-col overflow-hidden">
			{selectedBlock ? (
			<EmailBlockProperties
				block={selectedBlock}
				onChange={(updatedBlock) => handleUpdateBlock(updatedBlock.id, updatedBlock)}
				onDelete={handleDeleteBlock}
				onAddNestedBlock={handleAddNestedBlock}
			/>
			) : (
				<div className="h-full overflow-y-auto">
					<EmailTemplateSettings
						name={draftTemplate.name ?? ""}
						designTokens={draftTemplate.designTokens ?? {
							background: "#ffffff",
							surface: "#f8fafc",
							text: "#0f172a",
							primary: "#2563eb",
							fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
							borderRadius: 12,
						}}
						onChange={(updates) => {
							const nextTokens = updates.designTokens ?? draftTemplate.designTokens ?? {
								background: "#ffffff",
								surface: "#f8fafc",
								text: "#0f172a",
								primary: "#2563eb",
								fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
								borderRadius: 12,
							};
							handleDraftChange({
								name: updates.name ?? draftTemplate.name ?? "",
								designTokens: nextTokens,
							});
						}}
					/>
				</div>
			)}
		</div>
	);

	const canvasContent = (
		<div className="h-full flex flex-col overflow-hidden">
			<EmailCanvasHeader
				templates={safeTemplates}
				currentTemplate={baseTemplate}
				onTemplateChange={async (id: string) => {
					setDraftTemplate(null);
					setSelectedBlockId(undefined);
					await safeContextOnTemplateChange(id);
				}}
				onCreateNewTemplate={safeContextHandleCreateNewTemplate}
				isMobile={isMobile}
				isLive={isSubscribed}
				activeUsers={activeUsers}
			/>
			<div className="flex-1 overflow-hidden">
				<EmailDesignerCanvas
					blocks={draftTemplate.blocks ?? []}
					selectedBlockId={selectedBlockId}
					onSelectBlock={(id) => {
						setSelectedBlockId(id);
						if (isMobile) {
							setMobilePanelTab("properties");
							setMobilePanelOpen(true);
						}
					}}
					designTokens={draftTemplate.designTokens ?? {
						background: "#ffffff",
						surface: "#f8fafc",
						text: "#0f172a",
						primary: "#2563eb",
						fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
						borderRadius: 12,
					}}
				/>
			</div>
		</div>
	);

	return (
		<div className="flex h-screen overflow-hidden">
			{isMobile ? (
				<>
					<div className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16">
						{/* Mobile Header */}
						<div className="flex items-center justify-between p-4 border-b">
							<h1 className="text-xl font-semibold text-foreground">
								{draftTemplate?.name || t("emailDesigner.title")}
							</h1>
							<Button
								onClick={handleSave}
								disabled={!hasChanges || saveMutation.isPending}
								size="sm"
							>
								{saveMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4 mr-2" />
								)}
								{t("emailDesigner.actions.save")}
							</Button>
						</div>
						{canvasContent}
					</div>
					{/* Mobile Bottom Navigation */}
					<div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden">
						<div className="flex items-center justify-around h-16 px-2">
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "blocks" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "blocks") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("blocks");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Menu className="h-5 w-5" />
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.blocks")}
								</span>
							</Button>
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "preview" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "preview") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("preview");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Eye className="h-5 w-5" />
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.preview")}
								</span>
							</Button>
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "properties" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "properties") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("properties");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Settings className="h-5 w-5" />
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.properties")}
								</span>
							</Button>
						</div>
					</div>
					<Drawer
						open={mobilePanelOpen}
						onOpenChange={setMobilePanelOpen}
						direction="bottom"
					>
						<DrawerContent className="max-h-[85vh] flex flex-col">
							<Tabs
								value={mobilePanelTab}
								onValueChange={(v) =>
									setMobilePanelTab(
										v as "blocks" | "preview" | "properties",
									)
								}
								className="flex flex-col flex-1 min-h-0"
							>
								<div className="px-4 pt-2 pb-1 border-b shrink-0">
									<TabsList className="w-full">
										<TabsTrigger value="blocks" className="flex-1">
											{t("emailDesigner.mobile.blocks")}
										</TabsTrigger>
										<TabsTrigger value="preview" className="flex-1">
											{t("emailDesigner.mobile.preview")}
										</TabsTrigger>
										<TabsTrigger value="properties" className="flex-1">
											{t("emailDesigner.mobile.properties")}
										</TabsTrigger>
									</TabsList>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0">
									<TabsContent
										value="blocks"
										className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
									>
										<div className="h-full overflow-y-auto">
											{sidebarContent}
										</div>
									</TabsContent>
									<TabsContent
										value="preview"
										className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
									>
										<div className="h-full overflow-y-auto">
											<EmailDesignerCanvas
												blocks={draftTemplate.blocks}
												selectedBlockId={selectedBlockId}
												onSelectBlock={(id) => {
													setSelectedBlockId(id);
													setMobilePanelTab("properties");
												}}
												designTokens={draftTemplate.designTokens}
											/>
										</div>
									</TabsContent>
									<TabsContent
										value="properties"
										className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
									>
										<div className="h-full overflow-y-auto">
											{propertiesContent}
										</div>
									</TabsContent>
								</div>
							</Tabs>
						</DrawerContent>
					</Drawer>
				</>
			) : (
				<ResizablePanelGroup direction="horizontal" className="w-full h-full">
					<ResizablePanel defaultSize={18} minSize={16} maxSize={25} className="overflow-hidden">
						{sidebarContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel minSize={40} className="overflow-hidden">
						{canvasContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={22} minSize={18} maxSize={30} className="overflow-hidden">
						{propertiesContent}
					</ResizablePanel>
				</ResizablePanelGroup>
			)}
		</div>
	);
}

function createBlock(type: EmailTemplateBlock["type"], section: EmailSection): EmailTemplateBlock {
	if (type === "subject") {
		return {
			id: crypto.randomUUID(),
			type: "subject",
			section: "header",
			content: "Email subject",
		};
	}
	if (type === "preheader") {
		return {
			id: crypto.randomUUID(),
			type: "preheader",
			section: "header",
			content: "Email preheader",
		};
	}
	if (type === "logo") {
		return {
			id: crypto.randomUUID(),
			type: "logo",
			section: "header",
			src: "",
			alt: "Logo",
			width: 120,
			align: "center",
			borderRadius: 0,
		};
	}
	if (type === "navigation") {
		return {
			id: crypto.randomUUID(),
			type: "navigation",
			section: "header",
			links: [],
			align: "center",
		};
	}
	if (type === "text") {
		return {
			id: crypto.randomUUID(),
			type: "text",
			section: section,
			content: "New text block",
			align: "left",
			emphasize: false,
		};
	}
	if (type === "button") {
		return {
			id: crypto.randomUUID(),
			type: "button",
			section: section,
			label: "Call to action",
			url: "https://example.com",
			variant: "primary",
			align: "center",
			buttonWidth: "auto",
			buttonHeight: 44,
		};
	}
	if (type === "divider") {
		return {
			id: crypto.randomUUID(),
			type: "divider",
			section: section,
			style: "solid",
			color: "#e5e7eb",
			width: 1,
			align: "center",
			dividerWidth: 100,
		};
	}
	if (type === "spacer") {
		return {
			id: crypto.randomUUID(),
			type: "spacer",
			section: section,
			height: 16,
		};
	}
	if (type === "image") {
		return {
			id: crypto.randomUUID(),
			type: "image",
			section: section,
			src: "",
			alt: "",
			width: 400,
			align: "center",
			borderRadius: 0,
		};
	}
	if (type === "footerText") {
		return {
			id: crypto.randomUUID(),
			type: "footerText",
			section: "footer",
			content: "Footer text",
			align: "center",
		};
	}
	if (type === "socialLinks") {
		return {
			id: crypto.randomUUID(),
			type: "socialLinks",
			section: "footer",
			links: [],
			align: "center",
			iconSize: 24,
		};
	}
	if (type === "unsubscribe") {
		return {
			id: crypto.randomUUID(),
			type: "unsubscribe",
			section: "footer",
			text: "Unsubscribe",
			url: "#unsubscribe",
			align: "center",
		};
	}
	if (type === "columns") {
		const columnCount = 2;
		return {
			id: crypto.randomUUID(),
			type: "columns",
			section: section,
			columnCount: "2",
			gap: 16,
			align: "left",
			stackOnMobile: true,
			columns: Array.from({ length: columnCount }, () => ({
				id: crypto.randomUUID(),
				width: 100 / columnCount,
				blocks: [],
			})),
		};
	}
	if (type === "container") {
		return {
			id: crypto.randomUUID(),
			type: "container",
			section: section,
			maxWidth: 600,
			align: "center",
			padding: "md",
			blocks: [],
		};
	}
	// Fallback
	return {
		id: crypto.randomUUID(),
		type: "text",
		section: section,
		content: "New text block",
		align: "left",
		emphasize: false,
	};
}



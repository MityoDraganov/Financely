import { useState } from "react";
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
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Template, TemplateData } from "@/core";
import type { Organization } from "@/core/entities/organization";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { generateUniqueTemplateName } from "@/utils/template-naming";
import type { UseMutationResult } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";

type GenerateTemplatePayload = {
	organizationId: string;
	region?: "US" | "EU" | "CA" | "AU" | "UK";
	options?: {
		style?: "modern" | "classic" | "minimal" | "professional";
		includeLogo?: boolean;
		customPrompt?: string;
	};
};

type AIBuilderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentOrg: Organization | undefined;
	currentTemplate: Template | undefined;
	templates: Template[];
	generateTemplate: UseMutationResult<TemplateData, Error, GenerateTemplatePayload, unknown>;
	onTemplateCreated: (templateId: string) => void;
};

export function AIBuilderDialog({
	open,
	onOpenChange,
	currentOrg,
	currentTemplate,
	templates,
	generateTemplate,
	onTemplateCreated,
}: AIBuilderDialogProps) {
	const { t } = useTranslation();
	const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional">("modern");
	const [aiIncludeLogo, setAiIncludeLogo] = useState(true);
	const [aiPrompt, setAiPrompt] = useState("");

	const handleGenerate = async () => {
		if (!currentOrg) {
			toast.error(t('designer.aiBuilder.orgNotFound'));
			return;
		}

		try {
			const region = currentTemplate?.compliance?.region || invoiceComplianceService.detectRegion(currentOrg);
			const generatedTemplate = await generateTemplate.mutateAsync({
				organizationId: currentOrg.id,
				region,
				options: {
					style: aiStyle,
					includeLogo: aiIncludeLogo,
					customPrompt: aiPrompt.trim() || undefined,
				},
			});

			const baseName = generatedTemplate.name || t('designer.defaults.aiGeneratedTemplate');
			const uniqueName = generateUniqueTemplateName(baseName, templates);
			const templateWithUniqueName = {
				...generatedTemplate,
				name: uniqueName,
			};

			const templateId = await templateService.createDraft(templateWithUniqueName);
			onTemplateCreated(templateId);
			onOpenChange(false);
			setAiPrompt("");
			toast.success(t('designer.aiBuilder.generateSuccess'));
		} catch (error) {
			toast.error(
				t('designer.aiBuilder.generateFailed', { error: error instanceof Error ? error.message : "Unknown error" })
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(open) => {
			onOpenChange(open);
			if (!open) {
				setAiPrompt("");
			}
		}}>
			<DialogContent className="max-w-md max-h-[90vh] flex flex-col">
				<DialogHeader className="shrink-0">
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-purple-500" />
						{t('designer.aiBuilder.title')}
					</DialogTitle>
					<DialogDescription>
						{t('designer.aiBuilder.description')}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
					<div className="space-y-2">
						<Label>{t('designer.aiBuilder.style')}</Label>
						<Select
							value={aiStyle}
							onValueChange={(v) => setAiStyle(v as typeof aiStyle)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="modern">{t('designer.aiBuilder.modern')}</SelectItem>
								<SelectItem value="classic">{t('designer.aiBuilder.classic')}</SelectItem>
								<SelectItem value="minimal">{t('designer.aiBuilder.minimal')}</SelectItem>
								<SelectItem value="professional">{t('designer.aiBuilder.professional')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="include-logo">{t('designer.aiBuilder.includeLogo')}</Label>
						<input
							id="include-logo"
							type="checkbox"
							checked={aiIncludeLogo}
							onChange={(e) => setAiIncludeLogo(e.target.checked)}
							className="h-4 w-4 rounded border-gray-300"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ai-prompt">{t('designer.aiBuilder.additionalInstructions')}</Label>
						<Textarea
							id="ai-prompt"
							placeholder={t('designer.aiBuilder.instructionsPlaceholder')}
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							className="min-h-[80px] resize-none"
							rows={3}
						/>
						<p className="text-xs text-muted-foreground">
							{t('designer.aiBuilder.instructionsHint')}
						</p>
					</div>
					{currentOrg && (
						<div className="text-xs text-muted-foreground">
							{t('designer.aiBuilder.region', { region: currentTemplate?.compliance?.region || invoiceComplianceService.detectRegion(currentOrg) })}
						</div>
					)}
				</div>
				<DialogFooter className="shrink-0">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={generateTemplate.isPending}
					>
						{t('designer.aiBuilder.cancel')}
					</Button>
					<Button
						onClick={handleGenerate}
						disabled={generateTemplate.isPending || !currentOrg}
						className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
					>
						{generateTemplate.isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{t('designer.aiBuilder.generating')}
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								{t('designer.aiBuilder.generate')}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


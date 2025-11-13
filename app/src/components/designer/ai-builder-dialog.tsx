import { useState } from "react";
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
import type { Template } from "@/core";
import type { Organization } from "@/core/entities/organization";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { generateUniqueTemplateName } from "@/utils/template-naming";
import type { UseMutationResult } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";

type AIBuilderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentOrg: Organization | undefined;
	currentTemplate: Template | undefined;
	templates: Template[];
	generateTemplate: UseMutationResult<any, Error, any, unknown>;
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
	const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional">("modern");
	const [aiIncludeLogo, setAiIncludeLogo] = useState(true);
	const [aiPrompt, setAiPrompt] = useState("");

	const handleGenerate = async () => {
		if (!currentOrg) {
			toast.error("Organization not found");
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

			const baseName = generatedTemplate.name || "AI Generated Template";
			const uniqueName = generateUniqueTemplateName(baseName, templates);
			const templateWithUniqueName = {
				...generatedTemplate,
				name: uniqueName,
			};

			const templateId = await templateService.createDraft(templateWithUniqueName);
			onTemplateCreated(templateId);
			onOpenChange(false);
			setAiPrompt("");
			toast.success("AI template generated successfully!");
		} catch (error) {
			toast.error(
				`Failed to generate template: ${error instanceof Error ? error.message : "Unknown error"}`
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
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-purple-500" />
						AI Invoice Template Builder
					</DialogTitle>
					<DialogDescription>
						Generate a beautiful, functional, and fully compliant invoice template
						using AI. The template will be customized based on your organization's
						branding and compliance region.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>Style</Label>
						<Select
							value={aiStyle}
							onValueChange={(v) => setAiStyle(v as typeof aiStyle)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="modern">Modern</SelectItem>
								<SelectItem value="classic">Classic</SelectItem>
								<SelectItem value="minimal">Minimal</SelectItem>
								<SelectItem value="professional">Professional</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between">
						<Label htmlFor="include-logo">Include Logo</Label>
						<input
							id="include-logo"
							type="checkbox"
							checked={aiIncludeLogo}
							onChange={(e) => setAiIncludeLogo(e.target.checked)}
							className="h-4 w-4 rounded border-gray-300"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="ai-prompt">Additional Instructions (Optional)</Label>
						<Textarea
							id="ai-prompt"
							placeholder="E.g., 'Use a two-column layout for the header', 'Make the totals section more prominent', 'Add a payment terms section'..."
							value={aiPrompt}
							onChange={(e) => setAiPrompt(e.target.value)}
							className="min-h-[80px] resize-none"
							rows={3}
						/>
						<p className="text-xs text-neutral-500">
							Provide any specific design preferences or requirements for the template.
						</p>
					</div>
					{currentOrg && (
						<div className="text-xs text-neutral-500">
							Region: {currentTemplate?.compliance?.region || invoiceComplianceService.detectRegion(currentOrg)}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={generateTemplate.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleGenerate}
						disabled={generateTemplate.isPending || !currentOrg}
						className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
					>
						{generateTemplate.isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 mr-2" />
								Generate Template
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


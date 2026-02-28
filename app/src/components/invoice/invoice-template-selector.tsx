import { FileText } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Template } from "@/core";

interface InvoiceTemplateSelectorProps {
	templates: Template[];
	selectedTemplateId: string;
	onTemplateChange: (templateId: string) => void;
	selectedTemplate: Template | undefined;
}

export function InvoiceTemplateSelector({
	templates,
	selectedTemplateId,
	onTemplateChange,
	selectedTemplate,
}: InvoiceTemplateSelectorProps) {
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					Template
				</span>
				<div className="flex-1 h-px bg-border" />
			</div>

			<Select value={selectedTemplateId} onValueChange={onTemplateChange}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select a template…" />
				</SelectTrigger>
				<SelectContent>
					{templates.map((t) => (
						<SelectItem key={t.id} value={t.id}>
							<div className="flex items-center gap-2">
								<FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
								<span>{t.name}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{selectedTemplate?.description && (
				<p className="text-xs text-muted-foreground pl-0.5 inv-slide-up">
					{selectedTemplate.description}
				</p>
			)}
		</div>
	);
}

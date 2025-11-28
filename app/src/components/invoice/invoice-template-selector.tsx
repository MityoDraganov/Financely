import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
		<Card>
			<CardHeader>
				<CardTitle>Template</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<Label>Choose a template</Label>
					<Select value={selectedTemplateId} onValueChange={onTemplateChange}>
						<SelectTrigger>
							<SelectValue placeholder="Select template" />
						</SelectTrigger>
						<SelectContent>
							{templates.map((t) => (
								<SelectItem key={t.id} value={t.id}>
									<div className="flex items-center space-x-2">
										<FileText className="h-4 w-4" />
										<span>{t.name}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{selectedTemplate && (
					<div className="text-sm text-muted-foreground">
						<p>
							<strong>Description:</strong>{" "}
							{selectedTemplate.description || "No description"}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}


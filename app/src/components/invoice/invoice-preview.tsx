import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";

interface InvoicePreviewProps {
	template: Template | undefined;
	formData: Record<string, InvoiceDataValue>;
	isSubscribed: boolean;
}

export function InvoicePreview({
	template,
	formData,
	isSubscribed,
}: InvoicePreviewProps) {
	return (
		<Card className="h-fit">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Live Preview</CardTitle>
					{isSubscribed && (
						<div className="flex items-center space-x-2 text-xs text-muted-foreground">
							<div className="h-2 w-2 rounded-full bg-green-500"></div>
							<span>Live sync</span>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{template ? (
					<div className="w-full overflow-auto border rounded-lg">
						<TemplatePreview
							template={template}
							context={formData}
							zoom={0.8}
						/>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<FileText className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							Select a Template
						</h3>
						<p className="text-muted-foreground">
							Choose a template from the sidebar to preview your
							invoice
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}


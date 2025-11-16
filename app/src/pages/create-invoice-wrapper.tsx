import { useState, useMemo } from "react";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { InvoiceTemplateProvider } from "@/contexts/invoice-template-context";
import CreateInvoicePage from "./create-invoice";
import AppLayout from "@/components/layout";

export default function CreateInvoiceWrapper() {
	const { data: currentOrganization } = useCurrentOrganization();
	const { data: templates } = useTemplates(currentOrganization?.id);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
	const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

	const selectedTemplate = useMemo(() => {
		const list = templates ?? [];
		if (!selectedTemplateId && list.length > 0) {
			setSelectedTemplateId(list[0].id);
			return list[0];
		}
		return list.find((t) => t.id === selectedTemplateId);
	}, [templates, selectedTemplateId]);

	return (
		<InvoiceTemplateProvider
			templates={templates ?? []}
			selectedTemplateId={selectedTemplateId}
			setSelectedTemplateId={setSelectedTemplateId}
			selectedTemplate={selectedTemplate}
			previewDialogOpen={previewDialogOpen}
			setPreviewDialogOpen={setPreviewDialogOpen}
		>
			<AppLayout>
				<CreateInvoicePage />
			</AppLayout>
		</InvoiceTemplateProvider>
	);
}


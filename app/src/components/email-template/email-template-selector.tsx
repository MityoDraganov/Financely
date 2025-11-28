import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import { EmailTemplate, EmailTemplatePlaceholder } from "@/core";
import { EmailTemplateMappingDialog } from "./email-template-mapping-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";
import { getEmailTemplateMappingRepository } from "@/repositories/email-template-mapping-repository";

const databaseService = serviceHost.getDatabaseService();
const emailTemplateRepository = getEmailTemplateRealtimeRepository();
const emailTemplateMappingRepository = getEmailTemplateMappingRepository(databaseService);

type BindingField = {
	path: string;
	label: string;
	type: "text" | "number" | "date";
};

type EmailTemplateSelectorProps = {
	orgId: string;
	entityTemplateId: string;
	entityType: string;
	availableBindings: BindingField[];
	selectedTemplateId?: string;
	onTemplateChange: (templateId: string | undefined) => void;
};

export function EmailTemplateSelector({
	orgId,
	entityTemplateId,
	entityType,
	availableBindings,
	selectedTemplateId,
	onTemplateChange,
}: EmailTemplateSelectorProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

	// Fetch all email templates
	const { data: emailTemplates } = useQuery({
		queryKey: ["email-templates", orgId],
		queryFn: async () => {
			const result = await emailTemplateRepository.getAll({
				queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
			});
			return Array.isArray(result) ? result : result?.data || [];
		},
		enabled: !!orgId,
	});

	const templates = emailTemplates || [];

	// Fetch selected template
	const selectedTemplate = useMemo(() => {
		if (!selectedTemplateId) return undefined;
		return templates.find((t) => t.id === selectedTemplateId);
	}, [selectedTemplateId, templates]);

	// Fetch existing mapping
	const { data: existingMapping } = useQuery({
		queryKey: [
			"email-template-mapping",
			orgId,
			entityTemplateId,
			selectedTemplateId,
		],
		queryFn: async () => {
			if (!selectedTemplateId) return null;

			const mappings = await emailTemplateMappingRepository.getAll({
				queryConstraints: [
					{ field: "orgId", operator: "==", value: orgId },
					{ field: "emailTemplateId", operator: "==", value: selectedTemplateId },
					{ field: "entityTemplateId", operator: "==", value: entityTemplateId },
					{ field: "entityType", operator: "==", value: entityType },
				],
			});

			return Array.isArray(mappings) ? (mappings[0] || null) : null;
		},
		enabled: !!orgId && !!entityTemplateId && !!selectedTemplateId,
	});

	// Check if template needs mapping when selected
	useEffect(() => {
		if (selectedTemplate && !existingMapping && selectedTemplate.placeholders.length > 0) {
			// Template is selected but has no mapping - auto-open dialog
			setMappingDialogOpen(true);
		}
	}, [selectedTemplate, existingMapping]);

	const handleTemplateSelect = (templateId: string) => {
		onTemplateChange(templateId);
	};

	const handleMappingSave = async (mappings: Record<string, string>) => {
		if (!selectedTemplateId) return;

		const mappingData = {
			orgId,
			emailTemplateId: selectedTemplateId,
			entityTemplateId,
			entityType,
			mappings,
		};

		if (existingMapping) {
			// Update existing mapping
			await emailTemplateMappingRepository.update({
				id: existingMapping.id,
				data: mappingData,
			});
		} else {
			// Create new mapping
			await emailTemplateMappingRepository.create({
				data: mappingData,
			});
		}

		// Invalidate queries to refresh the mapping
		queryClient.invalidateQueries({
			queryKey: ["email-template-mapping", orgId, entityTemplateId, selectedTemplateId],
		});

		setMappingDialogOpen(false);
	};

	const handleEditMapping = () => {
		setMappingDialogOpen(true);
	};

	const canEditMapping =
		selectedTemplate &&
		selectedTemplate.placeholders.length > 0 &&
		existingMapping !== undefined;

	return (
		<div className="flex items-center gap-2">
			<Select value={selectedTemplateId || ""} onValueChange={handleTemplateSelect}>
				<SelectTrigger className="flex-1">
					<SelectValue placeholder={t("emailTemplateSelector.placeholder", "Select email template")} />
				</SelectTrigger>
				<SelectContent>
					{templates.map((template) => (
						<SelectItem key={template.id} value={template.id}>
							{template.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{canEditMapping && (
				<Button
					variant="outline"
					size="icon"
					onClick={handleEditMapping}
					title={t("emailTemplateSelector.editMapping", "Edit field mappings")}
				>
					<Settings className="h-4 w-4" />
				</Button>
			)}

			{selectedTemplate && (
				<EmailTemplateMappingDialog
					open={mappingDialogOpen}
					onOpenChange={setMappingDialogOpen}
					placeholders={selectedTemplate.placeholders}
					availableBindings={availableBindings}
					initialMappings={existingMapping?.mappings || {}}
					onSave={handleMappingSave}
				/>
			)}
		</div>
	);
}


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
import { EmailTemplate, InvoiceDataValue, type QueryConstraint } from "@/core";
import { EmailTemplateMappingDialog } from "./email-template-mapping-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { serviceHost } from "@/services";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";
import { getEmailTemplateMappingRepository } from "@/repositories/email-template-mapping-repository";
import {
	type EmailTemplateCompatibilityContext,
	isTemplateCompatibleWithContext,
} from "@/utils/email-template-compatibility";

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
	entityTemplateId?: string;
	entityType: string;
	compatibilityContext: EmailTemplateCompatibilityContext;
	availableBindings: BindingField[];
	selectedTemplateId?: string;
	entityData?: Record<string, InvoiceDataValue>;
	onTemplateChange: (templateId: string | undefined) => void;
};

export function EmailTemplateSelector({
	orgId,
	entityTemplateId,
	entityType,
	compatibilityContext,
	availableBindings,
	selectedTemplateId,
	entityData,
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
			return Array.isArray(result) ? result : [];
		},
		enabled: !!orgId,
	});

	const templates: EmailTemplate[] = useMemo(() => emailTemplates || [], [emailTemplates]);
	const compatibleTemplates: EmailTemplate[] = useMemo(
		() =>
			templates.filter((template) =>
				isTemplateCompatibleWithContext(template, compatibilityContext),
			),
		[templates, compatibilityContext],
	);

	useEffect(() => {
		if (!selectedTemplateId) return;
		const isStillCompatible = compatibleTemplates.some(
			(template) => template.id === selectedTemplateId,
		);
		if (!isStillCompatible) {
			onTemplateChange(undefined);
		}
	}, [selectedTemplateId, compatibleTemplates, onTemplateChange]);

	// Fetch selected template
	const selectedTemplate = useMemo(() => {
		if (!selectedTemplateId) return undefined;
		return compatibleTemplates.find((t: EmailTemplate) => t.id === selectedTemplateId);
	}, [selectedTemplateId, compatibleTemplates]);

	const templateIsSelfContained = useMemo(() => {
		if (selectedTemplate?.compatMode === "canonical_v1") {
			return true;
		}
		const placeholders = selectedTemplate?.placeholders ?? [];
		if (placeholders.length === 0) return true;
		return placeholders.every(
			(placeholder) =>
				placeholder.source?.type === "entity_field" &&
				!!placeholder.source.entity &&
				!!placeholder.source.path,
		);
	}, [selectedTemplate]);

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
			const queryConstraints: QueryConstraint[] = [
				{ field: "orgId", operator: "==", value: orgId },
				{ field: "emailTemplateId", operator: "==", value: selectedTemplateId },
				{ field: "entityType", operator: "==", value: entityType },
			];
			if (entityTemplateId) {
				queryConstraints.push({
					field: "entityTemplateId",
					operator: "==",
					value: entityTemplateId,
				});
			}

			const mappings = await emailTemplateMappingRepository.getAll({
				queryConstraints,
			});

			return Array.isArray(mappings) ? (mappings[0] || null) : null;
		},
			enabled: !!orgId && !!entityTemplateId && !!selectedTemplateId && !templateIsSelfContained,
		});

	// Check if template needs mapping when selected (only auto-open if no existing mapping)
	// Don't auto-open if user manually closed the dialog
	const [hasManuallyClosed, setHasManuallyClosed] = useState(false);
	
	useEffect(() => {
		const placeholders = selectedTemplate?.placeholders ?? [];
		if (
			selectedTemplate &&
			!templateIsSelfContained &&
			!existingMapping &&
			placeholders.length > 0 &&
			!hasManuallyClosed
		) {
			// Template is selected but has no mapping - auto-open dialog
			setMappingDialogOpen(true);
		}
	}, [selectedTemplate, templateIsSelfContained, existingMapping, hasManuallyClosed]);

	// Reset manual close flag when template changes
	useEffect(() => {
		setHasManuallyClosed(false);
	}, [selectedTemplateId]);

	const handleTemplateSelect = (templateId: string) => {
		onTemplateChange(templateId);
	};

	const handleMappingSave = async (mappings: Record<string, string>) => {
		if (!selectedTemplateId) return;

		const mappingData = {
			orgId,
			emailTemplateId: selectedTemplateId,
			entityType,
			mappings,
			...(entityTemplateId ? { entityTemplateId } : {}),
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

	// Show edit button when a template is selected and has placeholders
	const canEditMapping =
		selectedTemplate &&
		!templateIsSelfContained &&
		(selectedTemplate.placeholders?.length ?? 0) > 0;

	return (
		<div className="flex items-center gap-2">
			<Select value={selectedTemplateId || ""} onValueChange={handleTemplateSelect}>
				<SelectTrigger className="flex-1">
					<SelectValue placeholder={t("emailTemplateSelector.placeholder", "Select email template")} />
				</SelectTrigger>
				<SelectContent>
					{compatibleTemplates.map((template: EmailTemplate) => (
						<SelectItem key={template.id} value={template.id}>
							{template.name}
						</SelectItem>
					))}
					{compatibleTemplates.length === 0 && (
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							No compatible templates found
						</div>
					)}
				</SelectContent>
			</Select>

			{canEditMapping && (
				<Button
					variant="outline"
					size="icon"
					onClick={handleEditMapping}
					title={
						existingMapping
							? t("emailTemplateSelector.editMapping", "Edit field mappings")
							: t("emailTemplateSelector.configureMapping", "Configure field mappings")
					}
				>
					<Settings className="h-4 w-4" />
				</Button>
			)}

			{selectedTemplate && (
				<EmailTemplateMappingDialog
					open={mappingDialogOpen}
					onOpenChange={(open) => {
						setMappingDialogOpen(open);
						if (!open) {
							setHasManuallyClosed(true);
						}
					}}
					placeholders={selectedTemplate.placeholders}
					availableBindings={availableBindings}
					entityData={entityData}
					initialMappings={existingMapping?.mappings || {}}
					onSave={handleMappingSave}
				/>
			)}
		</div>
	);
}

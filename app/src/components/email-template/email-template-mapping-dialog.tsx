import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { EmailTemplatePlaceholder } from "@/core";

type BindingField = {
	path: string;
	label: string;
	type: "text" | "number" | "date";
};

type EmailTemplateMappingDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	placeholders: EmailTemplatePlaceholder[];
	availableBindings: BindingField[];
	initialMappings?: Record<string, string>;
	onSave: (mappings: Record<string, string>) => void;
};

export function EmailTemplateMappingDialog({
	open,
	onOpenChange,
	placeholders,
	availableBindings,
	initialMappings = {},
	onSave,
}: EmailTemplateMappingDialogProps) {
	const { t } = useTranslation();
	// Use a special marker for empty values since Select doesn't allow empty strings
	const EMPTY_VALUE_MARKER = "__EMPTY__";
	
	// Convert initial mappings: empty strings become the marker
	const normalizedInitialMappings = useMemo(() => {
		const normalized: Record<string, string> = {};
		for (const [key, value] of Object.entries(initialMappings)) {
			normalized[key] = value === "" ? EMPTY_VALUE_MARKER : value;
		}
		return normalized;
	}, [initialMappings]);

	const [mappings, setMappings] = useState<Record<string, string>>(normalizedInitialMappings);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Reset mappings when dialog opens with new initial mappings
	useMemo(() => {
		if (open) {
			setMappings(normalizedInitialMappings);
			// Clear errors for valid initial mappings
			const initialErrors: Record<string, string> = {};
			for (const placeholder of placeholders) {
				const mapping = normalizedInitialMappings[placeholder.key];
				if (!mapping || (mapping !== EMPTY_VALUE_MARKER && mapping.trim() === "")) {
					initialErrors[placeholder.key] = "This field is required";
				}
			}
			setErrors(initialErrors);
		}
	}, [open, normalizedInitialMappings, placeholders]);

	// Clear errors when mappings become valid
	useEffect(() => {
		setErrors((prev) => {
			const next = { ...prev };
			let changed = false;
			for (const placeholder of placeholders) {
				const mapping = mappings[placeholder.key];
				// If there's an error for this placeholder but the mapping is now valid, clear it
				if (next[placeholder.key] && mapping && (mapping === EMPTY_VALUE_MARKER || mapping.trim() !== "")) {
					delete next[placeholder.key];
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [mappings, placeholders]);

	const handleMappingChange = (placeholderKey: string, bindingPath: string) => {
		setMappings((prev) => ({
			...prev,
			[placeholderKey]: bindingPath,
		}));
		// Clear error for this field if a valid value is selected (either marker or actual binding)
		if (bindingPath && (bindingPath === EMPTY_VALUE_MARKER || bindingPath.trim() !== "")) {
			setErrors((prev) => {
				const next = { ...prev };
				delete next[placeholderKey];
				return next;
			});
		}
	};

	const validateMappings = (): boolean => {
		const newErrors: Record<string, string> = {};
		let isValid = true;

		for (const placeholder of placeholders) {
			const mapping = mappings[placeholder.key];
			// A mapping is valid if:
			// 1. It exists and is not empty (after trimming)
			// 2. OR it's the empty marker (intentionally empty)
			if (!mapping || (mapping !== EMPTY_VALUE_MARKER && mapping.trim() === "")) {
				newErrors[placeholder.key] = "This field is required";
				isValid = false;
			}
		}

		setErrors(newErrors);
		return isValid;
	};

	const handleSave = () => {
		if (!validateMappings()) {
			return;
		}

		// Convert marker back to empty string before saving
		const finalMappings: Record<string, string> = {};
		for (const [key, value] of Object.entries(mappings)) {
			finalMappings[key] = value === EMPTY_VALUE_MARKER ? "" : value;
		}

		onSave(finalMappings);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setMappings(normalizedInitialMappings);
		setErrors({});
		onOpenChange(false);
	};

	const hasErrors = Object.keys(errors).length > 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{t("emailTemplateMapping.dialog.title", "Map Email Template Placeholders")}
					</DialogTitle>
					<DialogDescription>
						{t(
							"emailTemplateMapping.dialog.description",
							"Map each email template placeholder to an invoice field. You can use the same invoice field for multiple placeholders.",
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{hasErrors && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								{t(
									"emailTemplateMapping.dialog.errors",
									"Please map all placeholders to invoice fields before saving.",
								)}
							</AlertDescription>
						</Alert>
					)}

					{placeholders.map((placeholder) => {
						const currentMapping = mappings[placeholder.key];
						const error = errors[placeholder.key];

						return (
							<div key={placeholder.id} className="space-y-2">
								<Label htmlFor={`mapping-${placeholder.id}`}>
									{placeholder.label || placeholder.key}
									{placeholder.description && (
										<span className="text-xs text-muted-foreground ml-2">
											({placeholder.description})
										</span>
									)}
									<span className="text-xs text-muted-foreground ml-2">
										({`{{${placeholder.key}}}`})
									</span>
								</Label>
								<Select
									value={currentMapping}
									onValueChange={(value) => handleMappingChange(placeholder.key, value)}
								>
									<SelectTrigger
										id={`mapping-${placeholder.id}`}
										className={error ? "border-destructive" : ""}
									>
										<SelectValue placeholder={t("emailTemplateMapping.dialog.selectPlaceholder", "Select invoice field")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={EMPTY_VALUE_MARKER}>
											{t("emailTemplateMapping.dialog.emptyValue", "Empty (intentionally)")}
										</SelectItem>
										{availableBindings.map((binding) => (
											<SelectItem key={binding.path} value={binding.path}>
												{binding.label} ({binding.path})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{error && (
									<p className="text-xs text-destructive">{error}</p>
								)}
							</div>
						);
					})}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						{t("common.cancel", "Cancel")}
					</Button>
					<Button onClick={handleSave}>
						{t("common.save", "Save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}


import { useState, useMemo, useEffect, useRef } from "react";
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
import { EmailTemplatePlaceholder, InvoiceDataValue, getBindingValue } from "@/core";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

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
	entityData?: Record<string, InvoiceDataValue>;
	onSave: (mappings: Record<string, string>) => void;
};

export function EmailTemplateMappingDialog({
	open,
	onOpenChange,
	placeholders,
	availableBindings,
	initialMappings = {},
	entityData,
	onSave,
}: EmailTemplateMappingDialogProps) {
	const { t } = useTranslation();
	// Use a special marker for empty values since Select doesn't allow empty strings
	const EMPTY_VALUE_MARKER = "__EMPTY__";
	// Use a sentinel value for unset mappings to keep Select controlled
	const UNSET_MARKER = "__UNSET__";
	
	// Convert initial mappings: empty strings become the marker
	const normalizedInitialMappings = useMemo(() => {
		console.group("[EmailTemplateMapping] Normalizing initial mappings");
		console.log("Raw initialMappings prop:", {
			initialMappings,
			keys: Object.keys(initialMappings),
			entries: Object.entries(initialMappings),
			isEmpty: Object.keys(initialMappings).length === 0,
		});
		const normalized: Record<string, string> = {};
		for (const [key, value] of Object.entries(initialMappings)) {
			normalized[key] = value === "" ? EMPTY_VALUE_MARKER : value;
			console.log(`  Normalized "${key}":`, {
				rawValue: value,
				normalizedValue: normalized[key],
				wasEmpty: value === "",
			});
		}
		console.log("Normalized result:", {
			normalized,
			keys: Object.keys(normalized),
			entries: Object.entries(normalized),
		});
		console.groupEnd();
		return normalized;
	}, [initialMappings]);

	const [mappings, setMappings] = useState<Record<string, string>>(normalizedInitialMappings);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Reset mappings when dialog opens - only initialize once when dialog first opens
	// Use a ref to track if we've initialized to prevent resetting user changes
	const hasInitializedRef = useRef(false);
	const lastInitialMappingsRef = useRef<string>("");
	
	// Reset initialization when initialMappings change (e.g., when switching templates)
	useEffect(() => {
		const currentMappingsKey = JSON.stringify(normalizedInitialMappings);
		if (lastInitialMappingsRef.current !== currentMappingsKey) {
			console.log("[EmailTemplateMapping] Initial mappings changed, resetting initialization", {
				previous: lastInitialMappingsRef.current,
				current: currentMappingsKey,
			});
			hasInitializedRef.current = false;
			lastInitialMappingsRef.current = currentMappingsKey;
		}
	}, [normalizedInitialMappings]);
	
	useEffect(() => {
		if (open && !hasInitializedRef.current) {
			console.group("🔵 [EmailTemplateMapping] Dialog opened - Initial validation");
			console.log("📥 Input data:", {
				normalizedInitialMappings,
				placeholders: placeholders.map(p => ({ key: p.key, id: p.id, label: p.label })),
				EMPTY_VALUE_MARKER,
			});
			
			// Initialize mappings - ensure all placeholders have a value
			// Use UNSET_MARKER for unset values to keep Select controlled and show placeholder
			const initializedMappings: Record<string, string> = {};
			for (const placeholder of placeholders) {
				const existingMapping = normalizedInitialMappings[placeholder.key];
				initializedMappings[placeholder.key] = existingMapping ?? UNSET_MARKER;
				console.log(`  Initializing "${placeholder.key}":`, {
					hadExistingMapping: existingMapping !== undefined,
					existingMappingValue: existingMapping,
					finalValue: initializedMappings[placeholder.key],
					isUnset: initializedMappings[placeholder.key] === UNSET_MARKER,
				});
			}
			
			console.log("📝 Initialized mappings (ensuring all placeholders have values):", {
				normalizedInitialMappings,
				initializedMappings,
				comparison: placeholders.map(p => ({
					key: p.key,
					normalized: normalizedInitialMappings[p.key],
					initialized: initializedMappings[p.key],
					hadMapping: normalizedInitialMappings[p.key] !== undefined,
				})),
			});
			
			setMappings(initializedMappings);
			// Validate initial mappings and set errors
			const initialErrors: Record<string, string> = {};
			for (const placeholder of placeholders) {
				const mapping = initializedMappings[placeholder.key];
				const typeCheck = typeof mapping;
				const isEmpty = mapping === "";
				const isMarker = mapping === EMPTY_VALUE_MARKER;
				const isUnset = mapping === UNSET_MARKER;
				const trimmedLength = typeof mapping === "string" ? mapping.trim().length : -1;
				
				const isValidMapping = typeof mapping === "string" &&
					mapping !== "" &&
					mapping !== UNSET_MARKER &&
					(mapping === EMPTY_VALUE_MARKER || mapping.trim().length > 0);
				
				console.log(`🔍 Validating placeholder "${placeholder.key}":`, {
					mapping,
					type: typeCheck,
					isEmpty,
					isMarker,
					isUnset,
					trimmedLength,
					isValidMapping,
					checks: {
						isString: typeCheck === "string",
						notEmpty: !isEmpty,
						notUnset: !isUnset,
						isMarkerOrHasLength: isMarker || trimmedLength > 0,
					},
				});
				
				if (!isValidMapping) {
					initialErrors[placeholder.key] = "This field is required";
					console.warn(`❌ Invalid mapping for "${placeholder.key}"`);
				} else {
					console.log(`✅ Valid mapping for "${placeholder.key}"`);
				}
			}
			console.log("📤 Output errors:", initialErrors);
			console.groupEnd();
			setErrors(initialErrors);
			hasInitializedRef.current = true;
		} else if (!open) {
			// Reset the ref when dialog closes so we can initialize again next time
			hasInitializedRef.current = false;
		}
	}, [open, normalizedInitialMappings, placeholders]);

	const handleMappingChange = (placeholderKey: string, bindingPath: string) => {
		console.group(`🟢 [EmailTemplateMapping] handleMappingChange - "${placeholderKey}"`);
		console.log("📥 Input:", {
			placeholderKey,
			bindingPath,
			bindingPathType: typeof bindingPath,
			bindingPathLength: bindingPath?.length,
			EMPTY_VALUE_MARKER,
		});
		
		// Update mappings state
		setMappings((prev) => {
			const newMappings = {
				...prev,
				[placeholderKey]: bindingPath,
			};
			console.log("📝 Updated mappings state:", {
				previous: prev,
				new: newMappings,
			});
			return newMappings;
		});
		
		// Validate immediately: a value is valid if it exists and is either the empty marker or a non-empty string
		// Ensure bindingPath is a string and check validity
		const typeCheck = typeof bindingPath;
		const isEmpty = bindingPath === "";
		const isMarker = bindingPath === EMPTY_VALUE_MARKER;
		const isUnset = bindingPath === UNSET_MARKER;
		const trimmedLength = typeof bindingPath === "string" ? bindingPath.trim().length : -1;
		
		const isValid = typeof bindingPath === "string" &&
			bindingPath !== "" &&
			bindingPath !== UNSET_MARKER &&
			(bindingPath === EMPTY_VALUE_MARKER || bindingPath.trim().length > 0);
		
		console.log("🔍 Validation checks:", {
			typeCheck,
			isEmpty,
			isMarker,
			isUnset,
			trimmedLength,
			isValid,
			checks: {
				isString: typeCheck === "string",
				notEmpty: !isEmpty,
				notUnset: !isUnset,
				isMarkerOrHasLength: isMarker || trimmedLength > 0,
			},
		});
		
		// Update errors state immediately - use functional update to ensure we're working with latest state
		setErrors((prev) => {
			const next = { ...prev };
			
			if (isValid) {
				// Clear error if valid
				if (next[placeholderKey]) {
					delete next[placeholderKey];
					console.log("✅ Clearing error - mapping is valid");
					console.log("📤 Updated errors:", next);
					console.groupEnd();
					return next;
				}
				console.log("ℹ️ No error to clear - mapping was already valid");
				console.groupEnd();
				return prev; // No change needed
			} else {
				// Set error if invalid
				if (next[placeholderKey] !== "This field is required") {
					next[placeholderKey] = "This field is required";
					console.warn("❌ Setting error - mapping is invalid");
					console.log("📤 Updated errors:", next);
					console.groupEnd();
					return next;
				}
				console.log("ℹ️ Error already set - mapping is still invalid");
				console.groupEnd();
				return prev; // Error already set
			}
		});
	};

	const validateMappings = (): boolean => {
		console.group("🟡 [EmailTemplateMapping] validateMappings - Final validation");
		console.log("📥 Current mappings state:", mappings);
		console.log("📥 Placeholders:", placeholders.map(p => ({ key: p.key, id: p.id })));
		
		const newErrors: Record<string, string> = {};
		let isValid = true;

		for (const placeholder of placeholders) {
			const mapping = mappings[placeholder.key];
			const typeCheck = typeof mapping;
			const isEmpty = mapping === "";
			const isMarker = mapping === EMPTY_VALUE_MARKER;
			const isUnset = mapping === UNSET_MARKER;
			const trimmedLength = typeof mapping === "string" ? mapping.trim().length : -1;
			
			// A mapping is valid if:
			// 1. It's a string type
			// 2. It's not empty
			// 3. It's not the unset marker
			// 4. AND either it's the empty marker OR it's a non-empty string (after trimming)
			const isValidMapping = typeof mapping === "string" &&
				mapping !== "" &&
				mapping !== UNSET_MARKER &&
				(mapping === EMPTY_VALUE_MARKER || mapping.trim().length > 0);
			
			console.log(`🔍 Validating "${placeholder.key}":`, {
				mapping,
				type: typeCheck,
				isEmpty,
				isMarker,
				isUnset,
				trimmedLength,
				isValidMapping,
				checks: {
					isString: typeCheck === "string",
					notEmpty: !isEmpty,
					notUnset: !isUnset,
					isMarkerOrHasLength: isMarker || trimmedLength > 0,
				},
			});
			
			if (!isValidMapping) {
				newErrors[placeholder.key] = "This field is required";
				isValid = false;
				console.warn(`❌ Invalid: "${placeholder.key}"`);
			} else {
				console.log(`✅ Valid: "${placeholder.key}"`);
			}
		}

		console.log("📤 Validation result:", {
			isValid,
			errors: newErrors,
			errorCount: Object.keys(newErrors).length,
		});
		console.groupEnd();
		
		setErrors(newErrors);
		return isValid;
	};

	const handleSave = () => {
		if (!validateMappings()) {
			return;
		}

		// Convert markers back to empty string before saving
		const finalMappings: Record<string, string> = {};
		for (const [key, value] of Object.entries(mappings)) {
			if (value === EMPTY_VALUE_MARKER || value === UNSET_MARKER) {
				finalMappings[key] = "";
			} else {
				finalMappings[key] = value;
			}
		}

		console.group("💾 [EmailTemplateMapping] Saving mappings");
		console.log("Final mappings to save:", {
			finalMappings,
			entries: Object.entries(finalMappings),
			keys: Object.keys(finalMappings),
			values: Object.values(finalMappings),
		});
		console.groupEnd();

		onSave(finalMappings);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setMappings(normalizedInitialMappings);
		setErrors({});
		onOpenChange(false);
	};

	const hasErrors = Object.keys(errors).length > 0;

	// Helper function to format binding value for display
	const formatBindingValue = (binding: BindingField): string => {
		if (!entityData) {
			return t("emailTemplateMapping.dialog.noData", "No data available");
		}

		try {
			// Handle array wildcard notation like "items[*].description"
			let pathToUse = binding.path;
			if (pathToUse.includes("[*]")) {
				// Replace [*] with [0] to get the first item's value
				pathToUse = pathToUse.replace("[*]", "[0]");
			}

			const value = getBindingValue(entityData, pathToUse);
			if (value === undefined || value === null) {
				// If using [0] didn't work, try getting the array itself
				if (pathToUse.includes("[0]")) {
					const arrayPath = pathToUse.split("[0]")[0];
					const arrayValue = getBindingValue(entityData, arrayPath);
					if (Array.isArray(arrayValue)) {
						return `[${arrayValue.length} ${t("emailTemplateMapping.dialog.items", "items")}]`;
					}
				}
				return t("emailTemplateMapping.dialog.valueNotSet", "Not set");
			}

			// Format based on type
			if (typeof value === "string") {
				return value;
			}
			if (typeof value === "number") {
				return value.toLocaleString();
			}
			if (typeof value === "boolean") {
				return value ? t("common.yes", "Yes") : t("common.no", "No");
			}
			if (Array.isArray(value)) {
				return `[${value.length} ${t("emailTemplateMapping.dialog.items", "items")}]`;
			}
			if (typeof value === "object") {
				// Try to extract a readable field
				const readableFields = ["description", "name", "title", "label", "text", "value"];
				for (const field of readableFields) {
					if (field in value && value[field] != null) {
						return String(value[field]);
					}
				}
				return `{${Object.keys(value).length} ${t("emailTemplateMapping.dialog.fields", "fields")}}`;
			}
			return String(value);
		} catch (error) {
			console.error(`[EmailTemplateMapping] Error getting value for binding "${binding.path}":`, error);
			return t("emailTemplateMapping.dialog.error", "Error");
		}
	};

	// Debug: Log current state on render
	useEffect(() => {
		if (open) {
			console.log("📊 [EmailTemplateMapping] Current state:", {
				mappings,
				errors,
				hasErrors,
				placeholders: placeholders.map(p => ({
					key: p.key,
					mapping: mappings[p.key],
					hasError: !!errors[p.key],
				})),
			});
		}
	}, [mappings, errors, hasErrors, open, placeholders]);

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

					{entityData && availableBindings.length > 0 && (
						<Accordion type="single" collapsible className="w-full">
							<AccordionItem value="available-bindings">
								<AccordionTrigger>
									{t("emailTemplateMapping.dialog.availableBindings", "Available Bindings")}
								</AccordionTrigger>
								<AccordionContent>
									<div className="rounded-md border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="w-[50%]">
														{t("emailTemplateMapping.dialog.binding", "Binding")}
													</TableHead>
													<TableHead className="w-[50%]">
														{t("emailTemplateMapping.dialog.valueInTemplate", "Value in Template")}
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{availableBindings.map((binding) => {
													const value = formatBindingValue(binding);
													return (
														<TableRow key={binding.path}>
															<TableCell className="font-mono text-sm">
																{binding.path}
															</TableCell>
															<TableCell className="text-sm">
																<span className="text-muted-foreground">{value}</span>
															</TableCell>
														</TableRow>
													);
												})}
											</TableBody>
										</Table>
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					)}

					<div className="space-y-4">
						<Label className="text-base font-semibold">
							{t("emailTemplateMapping.dialog.placeholderMappings", "Placeholder Mappings")}
						</Label>
						{placeholders.map((placeholder) => {
						// Get the current mapping value - always a string (UNSET_MARKER for unset values)
						const currentMapping = mappings[placeholder.key] ?? UNSET_MARKER;
						const error = errors[placeholder.key];
						
						// Convert UNSET_MARKER to undefined for Select (shows placeholder, keeps Select controlled)
						// Radix UI Select supports undefined as a controlled value - it shows the placeholder
						const selectValue = currentMapping === UNSET_MARKER ? undefined : currentMapping;

						// Debug log for render
						if (error) {
							console.log(`🔴 [EmailTemplateMapping] Render - Error shown for "${placeholder.key}":`, {
								placeholderKey: placeholder.key,
								currentMapping,
								mappingType: typeof currentMapping,
								error,
								hasMapping: currentMapping !== undefined && currentMapping !== "",
								isEmptyString: currentMapping === "",
								isMarker: currentMapping === EMPTY_VALUE_MARKER,
							});
						}

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
									value={selectValue}
									onValueChange={(value) => {
										console.log(`🟣 [EmailTemplateMapping] Select onValueChange - "${placeholder.key}":`, {
											placeholderKey: placeholder.key,
											receivedValue: value,
											valueType: typeof value,
											valueLength: value?.length,
											currentMappingBeforeChange: currentMapping,
											selectValueBeforeChange: selectValue,
										});
										// Select always passes a string value (one of the SelectItem values)
										handleMappingChange(placeholder.key, value);
									}}
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


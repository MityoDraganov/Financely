import { useState, useEffect } from "react";
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Sparkles, Loader2, Plus, Trash2, Key, FileText } from "lucide-react";
import type { ExtractionJob } from "@/repositories/extraction-job-repository";
import { cn } from "@/lib/utils";
import { useGenerateTemplateFromInvoiceFile } from "@/hooks/service-hooks/use-generate-template-from-extraction";

type FlowType = "template" | "invoice";

interface ExtractionResultsPanelProps {
	job: ExtractionJob;
	flowType?: FlowType; // Determines if we're creating template-only (keys editable, values read-only) or invoice (both editable)
	onFieldChange?: (field: string, value: unknown) => void;
	onSave?: (data: Record<string, unknown>) => void;
	onGenerateTemplate?: (editedData?: Record<string, unknown>) => void;
	isGenerating?: boolean;
}

export function ExtractionResultsPanel({
	job,
	flowType = "invoice", // Default to invoice flow for backward compatibility
	onFieldChange,
	onSave,
	onGenerateTemplate,
	isGenerating = false,
}: ExtractionResultsPanelProps) {
	const isTemplateOnly = flowType === "template";
	const [editedData, setEditedData] = useState<Record<string, unknown>>(
		job.correctedData || job.extractedData || {}
	);
	const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
	const generateTemplate = useGenerateTemplateFromInvoiceFile();

	// Update edited data when job.extractedData changes
	useEffect(() => {
		if (job.extractedData) {
			const initialData = job.correctedData || job.extractedData;
			console.log("[ExtractionResultsPanel] Initial data:", {
				extractedData: job.extractedData,
				correctedData: job.correctedData,
				usingData: initialData,
				dataKeys: Object.keys(initialData),
				dataStructure: JSON.stringify(initialData, null, 2),
			});
			setEditedData(initialData);
			setEditingKeys({});
		}
	}, [job.extractedData, job.correctedData]);

	if (!job.extractedData || Object.keys(job.extractedData).length === 0) {
		return (
			<Card>
				<CardContent className="p-6">
					<p className="text-sm text-muted-foreground text-center">
						No data extracted yet. Please wait for extraction to
						complete.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Helper to set nested value in object by path (e.g., "billedTo.name")
	const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
		const parts = path.split(".");
		const newObj = { ...obj };
		let current: Record<string, unknown> = newObj;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (!(part in current) || typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) {
				current[part] = {};
			}
			current = current[part] as Record<string, unknown>;
		}

		current[parts[parts.length - 1]] = value;
		return newObj;
	};

	// Helper to get nested value from object by path
	const getNestedValue = (obj: Record<string, unknown>, path: string): unknown => {
		const parts = path.split(".");
		let current: unknown = obj;
		for (const part of parts) {
			if (current && typeof current === "object" && !Array.isArray(current) && part in (current as Record<string, unknown>)) {
				current = (current as Record<string, unknown>)[part];
			} else {
				return undefined;
			}
		}
		return current;
	};

	const handleFieldChange = (field: string, value: unknown) => {
		console.log("[ExtractionResultsPanel] handleFieldChange:", {
			field,
			value,
			isNested: field.includes("."),
			currentEditedData: editedData,
		});

		// Check if it's a nested path
		if (field.includes(".")) {
			const updated = setNestedValue(editedData, field, value);
			console.log("[ExtractionResultsPanel] Updated nested value:", {
				field,
				oldData: editedData,
				newData: updated,
			});
			setEditedData(updated);
		} else {
			const updated = { ...editedData, [field]: value };
			console.log("[ExtractionResultsPanel] Updated top-level value:", {
				field,
				oldData: editedData,
				newData: updated,
			});
			setEditedData(updated);
		}
		onFieldChange?.(field, value);
	};

	const handleSave = () => {
		onSave?.(editedData);
	};

	const getConfidenceBadge = (field: string) => {
		// For "overall", calculate average confidence
		let confidence: number | undefined;
		if (field === "overall") {
			if (job.confidenceScores && Object.keys(job.confidenceScores).length > 0) {
				confidence = Object.values(job.confidenceScores).reduce((sum, score) => sum + score, 0) / Object.keys(job.confidenceScores).length;
			}
		} else {
			confidence = job.confidenceScores?.[field];
		}
		
		if (!confidence) return null;

		const isHigh = confidence >= 0.8;
		const isMedium = confidence >= 0.5 && confidence < 0.8;

		return (
			<Badge
				variant={
					isHigh ? "default" : isMedium ? "secondary" : "destructive"
				}
				className="ml-2"
			>
				{isHigh ? (
					<CheckCircle2 className="h-3 w-3 mr-1" />
				) : (
					<AlertCircle className="h-3 w-3 mr-1" />
				)}
				{(confidence * 100).toFixed(0)}%
			</Badge>
		);
	};

	const renderField = (
		key: string,
		value: unknown,
		path = ""
	): React.ReactNode => {
		const fullPath = path ? `${path}.${key}` : key;

		console.log("[ExtractionResultsPanel] renderField:", {
			key,
			path,
			fullPath,
			value,
			valueType: typeof value,
			isObject: typeof value === "object" && value !== null && !Array.isArray(value),
		});

		// Handle null/undefined - check if value exists in editedData
		// If value is null/undefined but we have a path, try to get it from editedData
		if (value === null || value === undefined) {
			const currentValue = fullPath ? getNestedValue(editedData, fullPath) : editedData[key];
			if (currentValue === undefined || currentValue === null) {
				// No value exists, but if we're in a nested structure, still render input for user to add value
				// Only skip if this is a top-level field with no value
				if (!path) {
					return null;
				}
				// For nested fields, render empty input so user can add value
				value = "";
			} else {
				// Value exists in editedData, use it
				value = currentValue;
			}
		}

		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			// Get the nested object from editedData to ensure we're working with current state
			const nestedObj = fullPath ? getNestedValue(editedData, fullPath) as Record<string, unknown> : editedData[key] as Record<string, unknown>;
			
			console.log("[ExtractionResultsPanel] renderField - nested object:", {
				fullPath,
				nestedObj,
				nestedObjKeys: nestedObj ? Object.keys(nestedObj) : [],
				isValid: nestedObj && typeof nestedObj === "object" && !Array.isArray(nestedObj),
			});

			if (!nestedObj || typeof nestedObj !== "object" || Array.isArray(nestedObj)) {
				return null;
			}

			// For nested objects, show editable key input + nested fields
			// Get the editing key state for this nested object
			const editingKey = editingKeys[fullPath] ?? key;
			const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();
			const isDuplicate = editingKey !== key && (fullPath ? getNestedValue(editedData, fullPath.replace(new RegExp(`\\.${key}$`), `.${editingKey}`)) !== undefined : editedData[editingKey] !== undefined);

			return (
				<div key={fullPath} className="space-y-3">
					{/* Small label showing the object key/path */}
					<div className="flex items-center gap-1.5 px-1">
						<Key className="h-3 w-3 text-muted-foreground shrink-0" />
						<Label
							htmlFor={fullPath}
							className="text-xs text-muted-foreground font-mono"
						>
							{fullPath}
						</Label>
					</div>

					{/* Object key input only - no value display */}
					<div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
						<Input
							value={formattedEditingKey}
							onChange={(e) => {
								// Convert formatted input back to camelCase for the actual key
								const rawKey = e.target.value
									.split(" ")
									.map((word, index) => 
										index === 0 
											? word.toLowerCase() 
											: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
									)
									.join("");
								
								// For nested paths, we need to handle key renaming differently
								// Since we can't easily rename nested object keys, we'll just update the editing state
								setEditingKeys((prev) => ({
									...prev,
									[fullPath]: rawKey,
								}));
							}}
							onBlur={(e) => {
								const formattedValue = e.target.value.trim();
								if (!formattedValue) {
									// Reset editing state
									setEditingKeys((prev) => {
										const next = { ...prev };
										delete next[fullPath];
										return next;
									});
									return;
								}

								// Convert formatted input back to camelCase
								const newKey = formattedValue
									.split(" ")
									.map((word, index) => 
										index === 0 
											? word.toLowerCase() 
											: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
									)
									.join("");

								if (newKey === key) {
									// Reset editing state if no change
									setEditingKeys((prev) => {
										const next = { ...prev };
										delete next[fullPath];
										return next;
									});
									return;
								}

								// For nested objects, renaming is complex - we'd need to restructure the data
								// For now, we'll just reset the editing state
								// TODO: Implement nested key renaming if needed
								setEditingKeys((prev) => {
									const next = { ...prev };
									delete next[fullPath];
									return next;
								});
							}}
							className={cn("text-sm font-medium capitalize bg-background flex-1", isDuplicate && "border-destructive")}
							placeholder="Object Key"
							title={isDuplicate ? "This key already exists" : "Edit object key name"}
						/>
						{path && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									// Remove nested object from parent
									const parentPath = path;
									const parentObj = getNestedValue(editedData, parentPath) as Record<string, unknown>;
									if (parentObj && typeof parentObj === "object") {
										const updated = { ...parentObj };
										delete updated[key];
										handleFieldChange(parentPath, updated);
									}
								}}
								className="shrink-0"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
					<div className="pl-6 space-y-2 ml-4 border-l-2 border-primary/20">
						{Object.entries(nestedObj).map(
							([subKey, subValue]) => {
								// Get the current value from editedData to ensure we have the latest
								const subFullPath = `${fullPath}.${subKey}`;
								const currentSubValue = getNestedValue(editedData, subFullPath) ?? subValue;
								
								console.log("[ExtractionResultsPanel] renderField - rendering nested entry:", {
									subKey,
									subValue,
									currentSubValue,
									parentPath: fullPath,
									fullSubPath: subFullPath,
									valueType: typeof currentSubValue,
								});
								
								// Always pass the current value from editedData
								return renderField(subKey, currentSubValue, fullPath);
							}
						)}
						{/* Add new nested field button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								const newKey = `newField_${Date.now()}`;
								const parentObj = getNestedValue(editedData, fullPath) as Record<string, unknown>;
								if (parentObj && typeof parentObj === "object") {
									const updated = { ...parentObj, [newKey]: "" };
									handleFieldChange(fullPath, updated);
								}
							}}
							className="w-full"
						>
							<Plus className="h-3 w-3 mr-2" />
							Add Field
						</Button>
					</div>
				</div>
			);
		}

		if (Array.isArray(value)) {
			// Get current array from editedData to ensure we're working with current state
			const currentArray = fullPath ? getNestedValue(editedData, fullPath) as unknown[] : editedData[key] as unknown[];
			const arrayValue = (Array.isArray(currentArray) ? currentArray : value);

			// Format the array key name
			const editingKey = editingKeys[fullPath] ?? key;
			const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();

			return (
				<div key={fullPath} className="space-y-3">
					{/* Small label showing the array key/path */}
					<div className="flex items-center gap-1.5 px-1">
						<Key className="h-3 w-3 text-muted-foreground shrink-0" />
						<Label
							htmlFor={fullPath}
							className="text-xs text-muted-foreground font-mono"
						>
							{fullPath}
						</Label>
					</div>

					{/* Array key input only - no value display */}
					<div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
						<Input
							value={formattedEditingKey}
							onChange={(e) => {
								// Convert formatted input back to camelCase for the actual key
								const rawKey = e.target.value
									.split(" ")
									.map((word, index) => 
										index === 0 
											? word.toLowerCase() 
											: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
									)
									.join("");
								
								setEditingKeys((prev) => ({
									...prev,
									[fullPath]: rawKey,
								}));
							}}
							onBlur={(e) => {
								const formattedValue = e.target.value.trim();
								if (!formattedValue) {
									setEditingKeys((prev) => {
										const next = { ...prev };
										delete next[fullPath];
										return next;
									});
									return;
								}

								const newKey = formattedValue
									.split(" ")
									.map((word, index) => 
										index === 0 
											? word.toLowerCase() 
											: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
									)
									.join("");

								if (newKey === key) {
									setEditingKeys((prev) => {
										const next = { ...prev };
										delete next[fullPath];
										return next;
									});
								}
							}}
							className="text-sm font-medium capitalize bg-background flex-1"
							placeholder="Array Key"
							title="Edit array key name"
						/>
						{path && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									// Remove array from parent
									const parentPath = path;
									const parentObj = getNestedValue(editedData, parentPath) as Record<string, unknown>;
									if (parentObj && typeof parentObj === "object") {
										const updated = { ...parentObj };
										delete updated[key];
										handleFieldChange(parentPath, updated);
									}
								}}
								className="shrink-0"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
					<div className="space-y-2 pl-6 ml-4 border-l-2 border-primary/20">
						{arrayValue.map((item, index) => {
							// Get current item from editedData
							const currentItem = fullPath 
								? (getNestedValue(editedData, `${fullPath}[${index}]`) ?? item)
								: item;

							return (
								<div key={index} className="border rounded-md p-3 bg-muted/30 space-y-2">
									<div className="flex items-center justify-between gap-2">
										<Label className="text-xs text-muted-foreground font-mono">
											{fullPath}[{index}]
										</Label>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => {
												const updated = [...arrayValue];
												updated.splice(index, 1);
												handleFieldChange(fullPath, updated);
											}}
											className="shrink-0 h-6 w-6"
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
									{typeof currentItem === "object" &&
									currentItem !== null && !Array.isArray(currentItem) ? (
										// Recursively render nested object fields
										<div className="space-y-2">
											{Object.entries(currentItem as Record<string, unknown>).map(
												([itemKey, itemValue]) =>
													renderField(
														itemKey,
														itemValue,
														`${fullPath}[${index}]`
													)
											)}
											{/* Add new field to array item */}
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													const itemObj = currentItem as Record<string, unknown>;
													const newKey = `newField_${Date.now()}`;
													const updatedItem = { ...itemObj, [newKey]: "" };
													const updated = [...arrayValue];
													updated[index] = updatedItem;
													handleFieldChange(fullPath, updated);
												}}
												className="w-full"
											>
												<Plus className="h-3 w-3 mr-2" />
												Add Field
											</Button>
										</div>
									) : Array.isArray(currentItem) ? (
										// Handle nested arrays recursively
										renderField(`item_${index}`, currentItem, `${fullPath}[${index}]`)
									) : (
										<div className="flex items-center gap-2">
											<Label className="text-sm text-muted-foreground min-w-[80px]">
												Item {index + 1}:
											</Label>
											<Input
												value={String(currentItem ?? "")}
												onChange={(e) => {
													if (isTemplateOnly) return; // Read-only for template-only flow
													const updated = [...arrayValue];
													updated[index] = e.target.value;
													handleFieldChange(fullPath, updated);
												}}
												disabled={isTemplateOnly}
												readOnly={isTemplateOnly}
												className={cn("flex-1", isTemplateOnly && "cursor-not-allowed opacity-60")}
											/>
										</div>
									)}
								</div>
							);
						})}
						{/* Add new array item button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								const updated = [...arrayValue, {}];
								handleFieldChange(fullPath, updated);
							}}
							className="w-full"
						>
							<Plus className="h-3 w-3 mr-2" />
							Add Item
						</Button>
					</div>
				</div>
			);
		}

		// Get current value from editedData to ensure we show the latest
		const currentValue = fullPath ? getNestedValue(editedData, fullPath) : editedData[key];
		
		console.log("[ExtractionResultsPanel] renderField - simple value:", {
			fullPath,
			key,
			value,
			currentValue,
			currentValueType: typeof currentValue,
			hasCurrentValue: currentValue !== undefined && currentValue !== null,
		});

		const displayValue = currentValue !== undefined && currentValue !== null ? currentValue : (value !== undefined && value !== null ? value : "");

		// Always render input for simple values - never just a label
		const inputValue = displayValue !== undefined && displayValue !== null ? String(displayValue) : "";
		
		console.log("[ExtractionResultsPanel] renderField - rendering input:", {
			fullPath,
			key,
			inputValue,
			displayValue,
			currentValue,
			value,
		});

		// For nested fields (when path is not empty), make the key editable too
		const isNested = !!path;
		const editingKey = isNested ? (editingKeys[fullPath] ?? key) : key;
		const formattedEditingKey = editingKey.replace(/([A-Z])/g, " $1").trim();
		const isDuplicate = isNested && editingKey !== key && (() => {
			// Check if the new key would create a duplicate in the parent object
			if (!path) return false;
			const parentPath = path;
			const parentObj = getNestedValue(editedData, parentPath) as Record<string, unknown>;
			if (!parentObj || typeof parentObj !== "object") return false;
			return editingKey !== key && editingKey in parentObj;
		})();

		// Format the value for display (as it will appear in template)
		const formatValueForDisplay = (val: unknown): string => {
			if (val === null || val === undefined) return "";
			if (typeof val === "string") return val;
			if (typeof val === "number") return val.toLocaleString();
			if (typeof val === "boolean") return val ? "Yes" : "No";
			if (Array.isArray(val)) return `Array(${val.length})`;
			if (typeof val === "object") {
				const keys = Object.keys(val);
				return keys.length > 0 ? `{${keys.join(", ")}}` : "{}";
			}
			return String(val);
		};

		const displayFormattedValue = formatValueForDisplay(currentValue ?? value);

		return (
			<div key={fullPath} className="group space-y-1">
				{/* Small label showing the field key/path */}
				<div className="flex items-center gap-1.5 px-1">
					<Key className="h-3 w-3 text-muted-foreground shrink-0" />
					<Label
						htmlFor={fullPath}
						className="text-xs text-muted-foreground font-mono"
					>
						{fullPath}
					</Label>
				</div>
				
					{/* Field name and value inputs */}
					<div className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/30 transition-colors border border-border/50 bg-background">
						{/* Always show editable key input for all fields */}
						<div className="flex-1 min-w-0">
							<Input
								value={formattedEditingKey}
								onChange={(e) => {
									// Convert formatted input back to camelCase
									const rawKey = e.target.value
										.split(" ")
										.map((word, index) => 
											index === 0 
												? word.toLowerCase() 
												: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
										)
										.join("");
									
									setEditingKeys((prev) => ({
										...prev,
										[fullPath]: rawKey,
									}));
								}}
								onBlur={(e) => {
									const formattedValue = e.target.value.trim();
									if (!formattedValue) {
										setEditingKeys((prev) => {
											const next = { ...prev };
											delete next[fullPath];
											return next;
										});
										return;
									}

									const newKey = formattedValue
										.split(" ")
										.map((word, index) => 
											index === 0 
												? word.toLowerCase() 
												: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
										)
										.join("");

									if (newKey === key) {
										setEditingKeys((prev) => {
											const next = { ...prev };
											delete next[fullPath];
											return next;
										});
										return;
									}

									// Handle key renaming
									if (path) {
										// Nested field - update parent object
										const parentPath = path;
										const parentObj = getNestedValue(editedData, parentPath) as Record<string, unknown>;
										if (parentObj && typeof parentObj === "object") {
											const value = parentObj[key];
											const updated = { ...parentObj };
											delete updated[key];
											updated[newKey] = value;
											handleFieldChange(parentPath, updated);
											
											setEditingKeys((prev) => {
												const next = { ...prev };
												delete next[fullPath];
												return next;
											});
										}
									} else {
										// Top-level field - update root object
										const value = editedData[key];
										const updated = { ...editedData };
										delete updated[key];
										updated[newKey] = value;
										setEditedData(updated);
										
										setEditingKeys((prev) => {
											const next = { ...prev };
											delete next[fullPath];
											return next;
										});
									}
								}}
								className={cn(
									"text-sm font-medium capitalize bg-background",
									isDuplicate && "border-destructive"
								)}
								placeholder="Field name"
								title={isDuplicate ? "This key already exists" : "Edit field name"}
							/>
						</div>
						
						{/* Value input with formatting */}
						<div className="flex-1 min-w-0 flex items-center gap-2">
							<FileText className="h-4 w-4 text-muted-foreground shrink-0" />
							<Input
								id={fullPath}
								value={displayFormattedValue}
								onChange={(e) => {
									if (isTemplateOnly) return; // Read-only for template-only flow
									
									console.log("[ExtractionResultsPanel] renderField - input onChange:", {
										fullPath,
										newValue: e.target.value,
										currentValue,
										currentValueType: typeof currentValue,
									});

									// Try to preserve type
									let typedValue: unknown = e.target.value;
									if (typeof currentValue === "number") {
										typedValue = parseFloat(e.target.value.replace(/,/g, "")) || 0;
									} else if (typeof currentValue === "boolean") {
										typedValue = e.target.value.toLowerCase() === "yes" || e.target.value === "true";
									}
									handleFieldChange(fullPath, typedValue);
								}}
								disabled={isTemplateOnly}
								readOnly={isTemplateOnly}
								className={cn(
									"flex-1 min-w-0 bg-background",
									isTemplateOnly && "cursor-not-allowed opacity-60",
									job.confidenceScores?.[fullPath] !== undefined &&
										job.confidenceScores[fullPath] < 0.5 &&
										"border-destructive"
								)}
								placeholder={isTemplateOnly 
									? "Value will be set when creating invoice" 
									: `Enter ${key.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`
								}
								title={isTemplateOnly 
									? "Template field - value will be set when creating invoice from this template" 
									: "Edit field value (formatted as it will appear in template)"
								}
							/>
						</div>
						
						{/* Delete button for nested fields */}
						{isNested && (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									// Remove nested field from parent object
									if (path) {
										const parentPath = path;
										const parentObj = getNestedValue(editedData, parentPath) as Record<string, unknown>;
										if (parentObj && typeof parentObj === "object") {
											const updated = { ...parentObj };
											delete updated[key];
											handleFieldChange(parentPath, updated);
										}
									}
								}}
								className="shrink-0"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
			</div>
		);
	};

	const handleGenerateTemplate = async () => {
		console.log("[ExtractionResultsPanel] Generating template with data:", {
			editedData,
			editedDataKeys: Object.keys(editedData),
			editedDataStructure: JSON.stringify(editedData, null, 2),
			originalExtractedData: job.extractedData,
			originalExtractedDataKeys: job.extractedData ? Object.keys(job.extractedData) : [],
		});

		if (onGenerateTemplate) {
			onGenerateTemplate(editedData);
		} else {
			try {
					await generateTemplate.mutateAsync({
						jobId: job.id,
						editedData,
						options: {
							style: "modern",
							templateName: `Template from ${job.fileName}`,
						},
						createTemplate: true,
					});
			} catch (error) {
				// Error is handled by the hook
				console.error("Failed to generate template:", error);
			}
		}
	};


	// Handle add new key-value pair
	const handleAdd = () => {
		const newKey = `newField_${Date.now()}`;
		const newData = { ...editedData, [newKey]: "" };
		setEditedData(newData);
		onFieldChange?.(newKey, "");
	};

	// Format value for display
	console.log("[ExtractionResultsPanel] Rendering with editedData:", {
		editedData,
		entries: Object.entries(editedData),
		entryCount: Object.keys(editedData).length,
	});

	// Calculate overall confidence score (average of all field confidence scores)
	const overallConfidence = job.confidenceScores && Object.keys(job.confidenceScores).length > 0
		? Object.values(job.confidenceScores).reduce((sum, score) => sum + score, 0) / Object.keys(job.confidenceScores).length
		: undefined;

	return (
		<div className="space-y-4">
			{/* Overall confidence badge - shown once at the top */}
			{overallConfidence !== undefined && (
				<div className="flex items-center justify-end px-1">
					{getConfidenceBadge("overall")}
				</div>
			)}
			{isTemplateOnly && (
				<div className="rounded-md bg-muted/50 border border-border p-3 text-sm text-muted-foreground">
					<strong className="text-foreground">Template Mode:</strong> Field names are editable. Values shown are examples and will be set when creating invoices from this template.
				</div>
			)}
			<div className="space-y-4">
				{Object.entries(editedData).map(([key, value]) => {
					console.log("[ExtractionResultsPanel] Rendering entry:", {
						key,
						value,
						valueType: typeof value,
						isObject: typeof value === "object" && value !== null,
						isArray: Array.isArray(value),
					});
					
					// Use renderField for all entries to ensure consistent formatting
					return (
						<div key={key}>
							{renderField(key, value, "")}
						</div>
					);
				})}
			</div>

			<Button
				variant="outline"
				onClick={handleAdd}
				className="w-full"
			>
				<Plus className="h-4 w-4 mr-2" />
				{isTemplateOnly ? "Add Field" : "Add Key-Value Pair"}
			</Button>

			<div className="flex justify-between items-center gap-2 pt-4 mt-4 border-t border-border/50">
				<Button
					onClick={handleGenerateTemplate}
					variant="default"
					disabled={isGenerating || generateTemplate.isPending}
					className="shadow-sm"
				>
					{(isGenerating || generateTemplate.isPending) ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Generating Template...
						</>
					) : (
						<>
							<Sparkles className="h-4 w-4 mr-2" />
							{isTemplateOnly ? "Generate Template" : "Generate Template & Invoice"}
						</>
					)}
				</Button>

				{onSave && !isTemplateOnly && (
					<Button onClick={handleSave} variant="outline">
						Save Changes
					</Button>
				)}
			</div>
		</div>
	);
}

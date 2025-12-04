import { useState } from "react";
import { Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import type { ExtractionJob } from "@/repositories/extraction-job-repository";
import { cn } from "@/lib/utils";
import { useGenerateTemplateFromExtraction } from "@/hooks/service-hooks/use-generate-template-from-extraction";

interface ExtractionResultsPanelProps {
	job: ExtractionJob;
	onFieldChange?: (field: string, value: unknown) => void;
	onSave?: (data: Record<string, unknown>) => void;
	onGenerateTemplate?: () => void;
	isGenerating?: boolean;
}

export function ExtractionResultsPanel({
	job,
	onFieldChange,
	onSave,
	onGenerateTemplate,
	isGenerating = false,
}: ExtractionResultsPanelProps) {
	const [editedData, setEditedData] = useState<Record<string, unknown>>(
		job.correctedData || job.extractedData || {}
	);
	const generateTemplate = useGenerateTemplateFromExtraction();

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

	const handleFieldChange = (field: string, value: unknown) => {
		const updated = { ...editedData, [field]: value };
		setEditedData(updated);
		onFieldChange?.(field, value);
	};

	const handleSave = () => {
		onSave?.(editedData);
	};

	const getConfidenceBadge = (field: string) => {
		const confidence = job.confidenceScores?.[field];
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

		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === "object" && !Array.isArray(value)) {
			return (
				<div key={fullPath} className="space-y-3">
					<Label className="text-base font-semibold capitalize">
						{key.replace(/([A-Z])/g, " $1").trim()}
					</Label>
					<div className="pl-4 space-y-3 ml-3 border-l border-border/30">
						{Object.entries(value as Record<string, unknown>).map(
							([subKey, subValue]) =>
								renderField(subKey, subValue, fullPath)
						)}
					</div>
				</div>
			);
		}

		if (Array.isArray(value)) {
			return (
				<div key={fullPath} className="space-y-3">
					<Label className="text-base font-semibold capitalize">
						{key.replace(/([A-Z])/g, " $1").trim()}
					</Label>
					<div className="space-y-2">
						{value.map((item, index) => (
							<div key={index} className="border rounded-md p-3 bg-muted/30">
								{typeof item === "object" &&
								item !== null ? (
									Object.entries(item).map(
										([itemKey, itemValue]) =>
											renderField(
												itemKey,
												itemValue,
												`${fullPath}[${index}]`
											)
									)
								) : (
									<div className="flex items-center gap-2">
										<Label className="text-sm text-muted-foreground">
											Item {index + 1}:
										</Label>
										<Input
											value={String(item)}
											onChange={(e) => {
												const updated = [...value];
												updated[index] =
													e.target.value;
												handleFieldChange(
													fullPath,
													updated
												);
											}}
											className="flex-1"
										/>
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div key={fullPath} className="space-y-2">
				<div className="flex items-center gap-2">
					<Label
						htmlFor={fullPath}
						className="text-sm font-medium capitalize"
					>
						{key.replace(/([A-Z])/g, " $1").trim()}
					</Label>
					{getConfidenceBadge(fullPath)}
				</div>
				<Input
					id={fullPath}
					value={String(value)}
					onChange={(e) => {
						// Try to preserve type
						let typedValue: unknown = e.target.value;
						if (typeof value === "number") {
							typedValue = parseFloat(e.target.value) || 0;
						} else if (typeof value === "boolean") {
							typedValue = e.target.value === "true";
						}
						handleFieldChange(fullPath, typedValue);
					}}
					className={cn(
						job.confidenceScores?.[fullPath] !== undefined &&
							job.confidenceScores[fullPath] < 0.5 &&
							"border-destructive"
					)}
				/>
			</div>
		);
	};

	const handleGenerateTemplate = async () => {
		if (onGenerateTemplate) {
			onGenerateTemplate();
		} else {
			try {
				await generateTemplate.mutateAsync({
					jobId: job.id,
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

	return (
		<div className="space-y-4">
			<div className="space-y-4">
				{Object.entries(job.extractedData).map(([key, value]) =>
					renderField(key, value)
				)}
			</div>

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
							Generate Template
						</>
					)}
				</Button>

				{onSave && (
					<Button onClick={handleSave} variant="outline">
						Save Changes
					</Button>
				)}
			</div>
		</div>
	);
}

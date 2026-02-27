import { useState, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	getBlockFieldValueType,
	normalizeSelectOptions,
	parseFieldValueByType,
	type WidgetFieldTypeMap,
} from "@/utils/widget-builder-validation";
import { functionsService } from "@/services/functions/functions-service";
import type {
	WidgetBlock,
	WidgetPage,
	WidgetVersionActions,
} from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";

export interface WidgetMultiStepOptions {
	showProgressBar?: boolean;
	progressBarPosition?: "top" | "bottom";
	progressStyle?: "steps" | "percentage";
	nextLabel?: string;
	backLabel?: string;
	submitLabel?: string;
}

export interface WidgetSchemaRendererProps {
	pages: WidgetPage[];
	actions: WidgetVersionActions;
	styling: Partial<WidgetStyling>;
	onSubmit: (payload: Record<string, string | boolean | number>) => Promise<void>;
	organizationId?: string;
	submitting?: boolean;
	submitError?: string | null;
	multiStepOptions?: WidgetMultiStepOptions;
	/** When set (e.g. in builder), show this page index only; no step navigation. */
	previewPageIndex?: number;
}

function getFieldKeysFromBlocks(blocks: WidgetBlock[]): string[] {
	const keys: string[] = [];
	for (const b of blocks) {
		if ("fieldKey" in b.props && typeof (b.props as { fieldKey?: string }).fieldKey === "string") {
			keys.push((b.props as { fieldKey: string }).fieldKey);
		}
		(b.children ?? []).forEach((child) => keys.push(...getFieldKeysFromBlocks([child])));
	}
	return keys;
}

const defaultStyling: WidgetStyling = {
	primaryColor: "#166534",
	secondaryColor: "#6b7280",
	backgroundColor: "#ffffff",
	textColor: "#111827",
	borderColor: "#d1d5db",
	errorColor: "#ef4444",
	successColor: "#166534",
	fontFamily: "system-ui, sans-serif",
	fontSize: "14px",
	fontWeight: "400",
	padding: "12px",
	gap: "16px",
	borderRadius: "8px",
	buttonPadding: "12px 24px",
	buttonBorderRadius: "8px",
	buttonFontWeight: "600",
	modalBackdropOpacity: "0.5",
	modalBorderRadius: "12px",
	modalMaxWidth: "500px",
	shadow: "0 4px 12px rgba(0,0,0,0.15)",
};

function renderBlock(
	block: WidgetBlock,
	s: WidgetStyling,
	key: string
): React.ReactNode {
	const props = block.props as Record<string, unknown>;
	switch (block.type) {
		case "container":
		case "card":
			return (
				<div
					key={key}
					className="space-y-4"
					style={{
						...(block.type === "card"
							? {
									backgroundColor: s.backgroundColor,
									border: `1px solid ${s.borderColor}`,
									borderRadius: s.borderRadius,
									boxShadow: s.shadow,
									padding: s.padding,
								}
							: {}),
					}}
				>
					{(block.children ?? []).map((child, i) =>
						renderBlock(child, s, `${block.id}-${i}`)
					)}
				</div>
			);
		case "sectionHeader":
			return (
				<div key={key} className="space-y-1">
					<h2
						className="text-xl font-semibold"
						style={{ color: s.textColor }}
					>
						{(props.title as string) ?? ""}
					</h2>
					{props.description != null && String(props.description) && (
						<p
							className="text-sm opacity-80"
							style={{ color: s.textColor }}
						>
							{String(props.description)}
						</p>
					)}
				</div>
			);
		case "columns": {
			const cols = typeof props.columns === "number" ? props.columns : 1;
			return (
				<div
					key={key}
					className="grid gap-4"
					style={{
						gridTemplateColumns: cols === 2 ? "1fr 1fr" : "1fr",
					}}
				>
					{(block.children ?? []).map((child, i) =>
						renderBlock(child, s, `${block.id}-${i}`)
					)}
				</div>
			);
		}
		case "divider":
			return (
				<hr
					key={key}
					style={{ borderColor: s.borderColor, margin: `${s.gap} 0` }}
				/>
			);
		case "spacer":
			return <div key={key} style={{ height: s.gap }} />;
		case "paragraph":
			return (
				<p
					key={key}
					className="text-sm"
					style={{ color: s.textColor }}
				>
					{(props.content as string) ?? ""}
				</p>
			);
		case "inputText":
		case "email":
		case "phone":
		case "textarea":
		case "date":
		case "file": {
			const label = (props.label as string) ?? "";
			const required = (props.required as boolean) ?? false;
			const placeholder = (props.placeholder as string) ?? "";
			const fieldKey = (props.fieldKey as string) ?? block.id;
			const helperText =
				props.helperText != null ? String(props.helperText) : undefined;
			const allowMultipleFiles =
				block.type === "file" && Boolean(props.multiple);
			const inputStyle = {
				borderColor: s.borderColor,
				borderRadius: s.borderRadius,
				color: s.textColor,
				backgroundColor: s.backgroundColor,
			};
			return (
				<div key={key}>
					<label
						className="block text-sm font-medium mb-1"
						style={{ color: s.textColor }}
					>
						{label}
						{required && (
							<span style={{ color: s.errorColor }}> *</span>
						)}
					</label>
					{block.type === "textarea" ? (
						<Textarea
							name={fieldKey}
							required={required}
							placeholder={placeholder}
							className="w-full resize-none"
							style={inputStyle}
						/>
					) : (
						<Input
							name={fieldKey}
							type={
								block.type === "date"
									? "date"
									: block.type === "email"
										? "email"
										: block.type === "phone"
											? "tel"
											: block.type === "file"
												? "file"
												: "text"
							}
							required={required}
							placeholder={placeholder}
							multiple={allowMultipleFiles}
							className="w-full"
							style={inputStyle}
						/>
					)}
					{helperText && (
						<p
							className="text-xs mt-1 opacity-70"
							style={{ color: s.textColor }}
						>
							{helperText}
						</p>
					)}
				</div>
			);
		}
		case "select": {
			const label = (props.label as string) ?? "";
			const required = (props.required as boolean) ?? false;
			const placeholder = (props.placeholder as string) ?? "";
			const fieldKey = (props.fieldKey as string) ?? block.id;
			const helperText =
				props.helperText != null ? String(props.helperText) : undefined;
			const options = normalizeSelectOptions(props.options);
			return (
				<div key={key}>
					<label
						className="block text-sm font-medium mb-1"
						style={{ color: s.textColor }}
					>
						{label}
						{required && (
							<span style={{ color: s.errorColor }}> *</span>
						)}
					</label>
					<Select name={fieldKey} required={required}>
						<SelectTrigger
							className="w-full"
							style={{
								borderColor: s.borderColor,
								borderRadius: s.borderRadius,
								color: s.textColor,
								backgroundColor: s.backgroundColor,
							}}
						>
							<SelectValue placeholder={placeholder || "Select..."} />
						</SelectTrigger>
						<SelectContent
							style={{
								borderColor: s.borderColor,
								color: s.textColor,
								backgroundColor: s.backgroundColor,
							}}
						>
							{options.map((option, optionIndex) => {
								const optionValue = option.value.trim();
								if (!optionValue) return null;
								return (
									<SelectItem key={`${fieldKey}-option-${optionIndex}`} value={optionValue}>
										{option.label || optionValue}
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>
					{helperText && (
						<p
							className="text-xs mt-1 opacity-70"
							style={{ color: s.textColor }}
						>
							{helperText}
						</p>
					)}
				</div>
			);
		}
		case "checkbox": {
			const label = (props.label as string) ?? "";
			const fieldKey = (props.fieldKey as string) ?? block.id;
			return (
				<div key={key} className="flex items-center gap-2">
					<input
						type="checkbox"
						name={fieldKey}
						id={fieldKey}
						className="rounded border"
						style={{
							borderColor: s.borderColor,
							accentColor: s.primaryColor,
						}}
					/>
					<label
						htmlFor={fieldKey}
						className="text-sm"
						style={{ color: s.textColor }}
					>
						{label}
					</label>
				</div>
			);
		}
		case "submitButton":
			return null;
		case "successBlock":
			return null;
		default:
			return null;
	}
}

function findSubmitButtonLabel(blocks: WidgetBlock[], actions: WidgetVersionActions): string {
	function walk(blockList: WidgetBlock[]): string | null {
		for (const b of blockList) {
			if (b.type === "submitButton") {
				const label = (b.props as { label?: string }).label;
				return label ?? "Submit";
			}
			if (b.children?.length) {
				const found = walk(b.children);
				if (found) return found;
			}
		}
		return null;
	}
	return walk(blocks) ?? actions.success?.message ?? "Submit";
}

function buildFieldTypeMapForForm(blocks: WidgetBlock[]): WidgetFieldTypeMap {
	const map: WidgetFieldTypeMap = {};
	const walkBlocks = (currentBlocks: WidgetBlock[]) => {
		currentBlocks.forEach((block) => {
			const props = (block.props ?? {}) as {
				fieldKey?: unknown;
			};
			const fieldKey = typeof props.fieldKey === "string" ? props.fieldKey : "";
			if (fieldKey) {
				const inferredByType =
					block.type === "checkbox"
						? "boolean"
						: block.type === "date"
							? "date"
							: "unknown";
				map[fieldKey] = getBlockFieldValueType(block, {}) ?? inferredByType;
			}
			if (block.children?.length) {
				walkBlocks(block.children);
			}
		});
	};

	walkBlocks(blocks);
	return map;
}

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(new Error("Failed to read selected file."));
				return;
			}
			const base64Data = result.includes(",") ? result.split(",")[1] : result;
			resolve(base64Data);
		};
		reader.onerror = () => reject(new Error("Failed to read selected file."));
		reader.readAsDataURL(file);
	});
}

async function uploadWidgetFile(
	file: File,
	organizationId: string
): Promise<string> {
	const extension = file.name.includes(".")
		? file.name.split(".").pop()
		: "";
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).slice(2, 10);
	const sanitizedName = sanitizeFileName(file.name);
	const path = `organizations/${organizationId}/widgets/submissions/${timestamp}-${randomSuffix}-${sanitizedName}${extension && !sanitizedName.endsWith(`.${extension}`) ? `.${extension}` : ""}`;
	const base64Data = await fileToBase64(file);
	const response = await functionsService.uploadFile({
		organizationId,
		fileName: file.name,
		fileData: base64Data,
		contentType: file.type || "application/octet-stream",
		path,
	});
	return response.url;
}

async function collectFormData(
	form: HTMLFormElement,
	fieldTypeByKey: WidgetFieldTypeMap,
	organizationId?: string,
): Promise<Record<string, string | boolean | number>> {
	const data: Record<string, string | boolean | number> = {};
	const inputs = form.querySelectorAll<
		HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
	>("input, textarea, select");
	for (const el of inputs) {
		const name = el.name;
		if (!name) continue;
		if (el instanceof HTMLInputElement && el.type === "checkbox") {
			data[name] = el.checked;
		} else if (el instanceof HTMLInputElement && el.type === "file") {
			const files = el.files ? Array.from(el.files) : [];
			if (files.length === 0) {
				data[name] = "";
			} else {
				const fileValues =
					organizationId && files.length > 0
						? await Promise.all(
								files.map(async (file) => {
									try {
										return await uploadWidgetFile(file, organizationId);
									} catch (error) {
										const reason =
											error instanceof Error
												? error.message
												: "File upload failed.";
										throw new Error(`Couldn't upload "${file.name}". ${reason}`);
									}
								})
						  )
						: files.map((file) => file.name);
				data[name] = el.multiple ? fileValues.join(", ") : fileValues[0] ?? "";
			}
		} else {
			data[name] = parseFieldValueByType(el.value ?? "", fieldTypeByKey[name]);
		}
	}
	return data;
}

export function WidgetSchemaRenderer({
	pages,
	actions,
	styling,
	onSubmit,
	organizationId,
	submitting = false,
	submitError = null,
	multiStepOptions,
	previewPageIndex,
}: WidgetSchemaRendererProps) {
	const s = { ...defaultStyling, ...styling };
	const isMultiStep = pages.length > 1;
	const [currentPageIndex, setCurrentPageIndex] = useState(0);
	const [formValues, setFormValues] = useState<Record<string, string | boolean | number>>({});
	const [processingFiles, setProcessingFiles] = useState(false);
	const [localSubmitError, setLocalSubmitError] = useState<string | null>(null);

	const isPreviewMode = previewPageIndex !== undefined && previewPageIndex >= 0;
	const effectiveIndex = isPreviewMode
		? Math.min(previewPageIndex, Math.max(0, pages.length - 1))
		: currentPageIndex;
	const safePageIndex =
		pages.length === 0 ? 0 : Math.min(effectiveIndex, pages.length - 1);
	const currentPage = pages[safePageIndex] ?? null;
	const currentBlocks = Array.isArray(currentPage?.fields) ? currentPage.fields : [];
	const allBlocks = useMemo(
		() => pages.flatMap((page) => (Array.isArray(page.fields) ? page.fields : [])),
		[pages],
	);
	const fieldTypeByKey = useMemo(
		() => buildFieldTypeMapForForm(allBlocks),
		[allBlocks],
	);
	const isLastPage = isMultiStep && safePageIndex === pages.length - 1;

	const nextLabel = multiStepOptions?.nextLabel ?? "Continue";
	const backLabel = multiStepOptions?.backLabel ?? "Back";
	const submitLabelFromOptions = multiStepOptions?.submitLabel;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLocalSubmitError(null);
		setProcessingFiles(true);
		try {
			const currentData = await collectFormData(form, fieldTypeByKey, organizationId);
			const payload = isMultiStep ? { ...formValues, ...currentData } : currentData;
			await onSubmit(payload);
		} catch (error) {
			setLocalSubmitError(
				error instanceof Error
					? error.message
					: "We couldn't prepare your files for upload.",
			);
		} finally {
			setProcessingFiles(false);
		}
	};

	const handleNext = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		setLocalSubmitError(null);
		setProcessingFiles(true);
		try {
			const currentData = await collectFormData(form, fieldTypeByKey, organizationId);
			setFormValues((prev) => ({ ...prev, ...currentData }));
			setCurrentPageIndex((i) => Math.min(i + 1, pages.length - 1));
		} catch (error) {
			setLocalSubmitError(
				error instanceof Error
					? error.message
					: "We couldn't prepare your files for upload.",
			);
		} finally {
			setProcessingFiles(false);
		}
	};

	const handleBack = () => {
		setCurrentPageIndex((i) => Math.max(0, i - 1));
	};

	const hasSubmitButton = currentBlocks.some((b) => {
		if (b.type === "submitButton") return true;
		return b.children?.some((c) => c.type === "submitButton");
	});
	const submitLabel =
		submitLabelFromOptions ??
		findSubmitButtonLabel(currentBlocks, actions);

	const previousPageFieldKeys = useMemo(() => {
		if (!isMultiStep || safePageIndex === 0) return [];
		let keys: string[] = [];
		for (let i = 0; i < safePageIndex; i++) {
			const pageFields = pages[i]?.fields;
			keys = keys.concat(
				getFieldKeysFromBlocks(Array.isArray(pageFields) ? pageFields : []),
			);
		}
		return keys;
	}, [isMultiStep, safePageIndex, pages]);

	const formSubmitHandler = isMultiStep && !isLastPage ? handleNext : handleSubmit;

	const progressPct =
		pages.length > 0 ? ((safePageIndex + 1) / pages.length) * 100 : 0;

	const progressBarEl =
		isMultiStep && (multiStepOptions?.showProgressBar !== false) ? (
			<div key="progress" className="space-y-2">
				{multiStepOptions?.progressStyle === "percentage" ? (
					<p className="text-xs font-medium" style={{ color: s.textColor }}>
						{Math.round(progressPct)}%
					</p>
				) : (
					<p className="text-xs font-medium" style={{ color: s.textColor }}>
						{currentPage?.name ?? `Page ${safePageIndex + 1}`} ({safePageIndex + 1} / {pages.length})
					</p>
				)}
				<div
					className="h-1.5 w-full rounded-full overflow-hidden"
					style={{ backgroundColor: s.borderColor }}
				>
					<div
						className="h-full rounded-full transition-[width]"
						style={{
							width: `${progressPct}%`,
							backgroundColor: s.primaryColor,
						}}
					/>
				</div>
			</div>
		) : null;

	const progressBarAtTop = (multiStepOptions?.progressBarPosition ?? "top") === "top";

	return (
		<form onSubmit={formSubmitHandler} className="space-y-4">
			{progressBarAtTop && progressBarEl}
			{isMultiStep && currentPage?.description && (
				<p className="text-sm opacity-80" style={{ color: s.textColor }}>
					{currentPage.description}
				</p>
			)}
			{isMultiStep && !isPreviewMode &&
				previousPageFieldKeys.map((key) => {
					const val = formValues[key];
					if (val === undefined) return null;
					return (
						<input
							key={key}
							type="hidden"
							name={key}
							value={typeof val === "boolean" ? (val ? "true" : "false") : val}
						/>
					);
				})}
			{currentBlocks.map((block, i) =>
				renderBlock(block, s, block.id || `block-${i}`)
			)}
			{!progressBarAtTop && progressBarEl}
			{(submitError || localSubmitError) && (
				<p
					className="text-sm py-2 px-3 rounded-md"
					style={{
						backgroundColor: `${s.errorColor}20`,
						color: s.errorColor,
						border: `1px solid ${s.errorColor}`,
					}}
				>
					{localSubmitError ?? submitError}
				</p>
			)}
			{isMultiStep ? (
				<div className="flex gap-2">
					{safePageIndex > 0 && (
						<Button
							type="button"
							variant="outline"
							onClick={handleBack}
							disabled={processingFiles}
							className="shrink-0"
							style={{
								borderColor: s.borderColor,
								color: s.textColor,
							}}
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							{backLabel}
						</Button>
					)}
					<div className="flex-1 min-w-0" />
					{isLastPage && hasSubmitButton ? (
						<Button
							type="submit"
							disabled={submitting || processingFiles}
							className="shrink-0"
							style={{
								backgroundColor: s.primaryColor,
								color: s.backgroundColor,
								padding: s.buttonPadding,
								borderRadius: s.buttonBorderRadius,
							}}
						>
							{submitting || processingFiles ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{submitting ? "Submitting..." : "Uploading files..."}
								</>
							) : (
								submitLabel
							)}
						</Button>
					) : (
						<Button
							type="submit"
							disabled={processingFiles}
							className="shrink-0"
							style={{
								backgroundColor: s.primaryColor,
								color: s.backgroundColor,
								padding: s.buttonPadding,
								borderRadius: s.buttonBorderRadius,
							}}
						>
							{processingFiles ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Uploading files...
								</>
							) : (
								<>
									{nextLabel}
									<ChevronRight className="h-4 w-4 ml-1" />
								</>
							)}
						</Button>
					)}
				</div>
			) : (
				hasSubmitButton && (
					<Button
						type="submit"
						disabled={submitting || processingFiles}
						className="w-full"
						style={{
							backgroundColor: s.primaryColor,
							color: s.backgroundColor,
							padding: s.buttonPadding,
							borderRadius: s.buttonBorderRadius,
						}}
					>
						{submitting || processingFiles ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{submitting ? "Submitting..." : "Uploading files..."}
							</>
						) : (
							submitLabel
						)}
					</Button>
				)
			)}
		</form>
	);
}

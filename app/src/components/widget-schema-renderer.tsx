import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
	WidgetBlockSchema,
	WidgetBlock,
	WidgetVersionActions,
} from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";

export interface WidgetSchemaRendererProps {
	schema: WidgetBlockSchema;
	actions: WidgetVersionActions;
	styling: Partial<WidgetStyling>;
	onSubmit: (payload: Record<string, string | boolean>) => Promise<void>;
	submitting?: boolean;
	submitError?: string | null;
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
			const options = (props.options as string[]) ?? [];
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
					<select
						name={fieldKey}
						required={required}
						className="w-full rounded-md border px-3 py-2 text-sm"
						style={{
							borderColor: s.borderColor,
							borderRadius: s.borderRadius,
							color: s.textColor,
							backgroundColor: s.backgroundColor,
						}}
					>
						<option value="">{placeholder || "Select..."}</option>
						{options.map((opt) => (
							<option key={opt} value={opt}>
								{opt}
							</option>
						))}
					</select>
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

function findSubmitButtonLabel(schema: WidgetBlockSchema, actions: WidgetVersionActions): string {
	function walk(blocks: WidgetBlock[]): string | null {
		for (const b of blocks) {
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
	return walk(schema) ?? actions.success?.message ?? "Submit";
}

export function WidgetSchemaRenderer({
	schema,
	actions,
	styling,
	onSubmit,
	submitting = false,
	submitError = null,
}: WidgetSchemaRendererProps) {
	const s = { ...defaultStyling, ...styling };

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = e.currentTarget;
		const data: Record<string, string | boolean> = {};
		const inputs = form.querySelectorAll<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>("input, textarea, select");
		inputs.forEach((el) => {
			const name = el.name;
			if (!name) return;
			if (el instanceof HTMLInputElement && el.type === "checkbox") {
				data[name] = el.checked;
			} else if (el instanceof HTMLInputElement && el.type === "file" && el.files?.[0]) {
				data[name] = el.files[0].name;
			} else {
				data[name] = (el.value ?? "") as string;
			}
		});
		await onSubmit(data);
	};

	const hasSubmitButton = schema.some((b) => {
		if (b.type === "submitButton") return true;
		return b.children?.some((c) => c.type === "submitButton");
	});
	const submitLabel = findSubmitButtonLabel(schema, actions);

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{schema.map((block, i) => renderBlock(block, s, block.id || `block-${i}`))}
			{submitError && (
				<p
					className="text-sm py-2 px-3 rounded-md"
					style={{
						backgroundColor: `${s.errorColor}20`,
						color: s.errorColor,
						border: `1px solid ${s.errorColor}`,
					}}
				>
					{submitError}
				</p>
			)}
			{hasSubmitButton && (
				<Button
					type="submit"
					disabled={submitting}
					className="w-full"
					style={{
						backgroundColor: s.primaryColor,
						color: s.backgroundColor,
						padding: s.buttonPadding,
						borderRadius: s.buttonBorderRadius,
					}}
				>
					{submitting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Submitting...
						</>
					) : (
						submitLabel
					)}
				</Button>
			)}
		</form>
	);
}

import { useRef, useMemo, useCallback, useEffect, useLayoutEffect } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent, MutableRefObject, ReactNode } from "react";
import { EmailTemplateBlock, EmailTemplatePlaceholder, EmailTypography, EmailBorder } from "@/core";
import type { DynamicSourceField } from "@/utils/dynamic-sources";
import {
	DynamicSourceInsertMenu,
	DynamicSourceTokenMenu,
	type DynamicSourceOption,
} from "@/components/email-designer/dynamic-source-token-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";
import { parseNumber } from "@/lib/field-formatting";

type EmailBlockPropertiesProps = {
  block?: EmailTemplateBlock;
  onChange: (updatedBlock: EmailTemplateBlock) => void;
  onDelete: (blockId: string) => void;
	onOpenImagePicker?: (blockId: string) => void;
	placeholders: EmailTemplatePlaceholder[];
	dynamicSources: DynamicSourceField[];
	onSelectDynamicSource: (source: DynamicSourceField) => EmailTemplatePlaceholder;
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

type EmailTableBlock = Extract<EmailTemplateBlock, { type: "table" }>;
type EmailTableColumn = EmailTableBlock["columns"][number];

const EMAIL_TABLE_CUSTOM_OPTION = "__custom__";

const EMAIL_TABLE_DATA_SOURCE_PRESETS = [
	{ value: "email.invoice.items", label: "Invoice items (recommended)" },
	{ value: "items", label: "Invoice items (items)" },
	{ value: "invoice.data.items", label: "Invoice line items (invoice.data.items)" },
	{ value: "invoice.items", label: "Invoice line items (invoice.items)" },
	{ value: "products", label: "Products (products)" },
] as const;

const EMAIL_TABLE_BINDING_OPTIONS = [
	{ value: "description", label: "description" },
	{ value: "name", label: "name" },
	{ value: "quantity", label: "quantity" },
	{ value: "qty", label: "qty" },
	{ value: "unitPrice", label: "unitPrice" },
	{ value: "price", label: "price" },
	{ value: "total", label: "total" },
	{ value: "lineTotal", label: "lineTotal" },
	{ value: "taxRate", label: "taxRate" },
	{ value: "sku", label: "sku" },
	{ value: "currency", label: "currency" },
] as const;

const createEmailTableColumn = (
	config: Omit<EmailTableColumn, "id">,
): EmailTableColumn => ({
	id: crypto.randomUUID(),
	...config,
});

const createInvoiceLineItemColumns = (): EmailTableColumn[] => [
	createEmailTableColumn({
		header: "Description",
		binding: "description",
		type: "text",
		align: "left",
		priority: "high",
		format: "none",
	}),
	createEmailTableColumn({
		header: "Quantity",
		binding: "quantity",
		type: "number",
		align: "center",
		priority: "medium",
		format: "number",
	}),
	createEmailTableColumn({
		header: "Unit Price",
		binding: "unitPrice",
		type: "currency",
		align: "right",
		priority: "high",
		format: "currency",
		currency: "USD",
	}),
	createEmailTableColumn({
		header: "Total",
		binding: "total",
		type: "currency",
		align: "right",
		priority: "high",
		format: "currency",
		currency: "USD",
	}),
];

const createProductCatalogColumns = (): EmailTableColumn[] => [
	createEmailTableColumn({
		header: "Product",
		binding: "name",
		type: "text",
		align: "left",
		priority: "high",
		format: "none",
	}),
	createEmailTableColumn({
		header: "SKU",
		binding: "sku",
		type: "text",
		align: "left",
		priority: "medium",
		format: "none",
	}),
	createEmailTableColumn({
		header: "Price",
		binding: "price",
		type: "currency",
		align: "right",
		priority: "high",
		format: "currency",
		currency: "USD",
	}),
];

// Helper function to get default typography
const getDefaultTypography = () => ({
  fontSize: 16,
  fontWeight: "normal" as const,
  lineHeight: 1.5,
  letterSpacing: 0,
  color: "",
  fontStyle: "normal" as const,
  textDecoration: "none" as const,
});

// Helper function to get default spacing
const getDefaultSpacing = () => ({
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
});

// Helper function to get default border
const getDefaultBorder = () => ({
  borderWidth: 0,
  borderColor: "#e5e7eb",
  borderStyle: "solid" as const,
  borderRadius: 0,
});

const getDynamicTokenString = (key: string) => `{{${key}}}`;

const formatDynamicLabel = (
	key: string,
	placeholders: EmailTemplatePlaceholder[],
	dynamicSourcesByKey: Map<string, DynamicSourceField>
) => {
	const match = placeholders.find(
		(placeholder) => placeholder.key.toLowerCase() === key.toLowerCase()
	);
	if (match?.label?.trim()) {
		return match.label.trim();
	}
	const dynamicSource = dynamicSourcesByKey.get(key.toLowerCase());
	return dynamicSource?.label ?? key;
};

const buildAvailableDynamicSourceOptions = (
	dynamicSources: DynamicSourceField[],
): DynamicSourceOption[] => {
	const sourceByKey = new Map<string, DynamicSourceField>();
	dynamicSources.forEach((source) => {
		sourceByKey.set(source.placeholderKey.toLowerCase(), source);
	});

	return Array.from(sourceByKey.values()).map((dynamicSource) => ({
		key: dynamicSource.placeholderKey,
		label: dynamicSource.label,
		description: dynamicSource.description,
		dynamicSource,
		categoryKey: dynamicSource.entity,
		categoryLabel: dynamicSource.entityLabel,
	}));
};

const removeDynamicTokenAt = (
	value: string,
	key: string,
	startIndex: number
) => {
	const token = getDynamicTokenString(key);
	if (startIndex >= 0) {
		return value.slice(0, startIndex) + value.slice(startIndex + token.length);
	}
	return value.replace(token, "");
};

const replaceDynamicTokenAt = (
	value: string,
	fromKey: string,
	toKey: string,
	startIndex: number
) => {
	const fromToken = getDynamicTokenString(fromKey);
	const toToken = getDynamicTokenString(toKey);
	if (startIndex >= 0) {
		return value.slice(0, startIndex) + toToken + value.slice(startIndex + fromToken.length);
	}
	return value.replace(fromToken, toToken);
};

const getNodeLogicalLength = (node: Node): number => {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent?.length ?? 0;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return 0;
	}
	const element = node as HTMLElement;
	const tokenKey = element.dataset.dynamicTokenKey;
	if (tokenKey) {
		return getDynamicTokenString(tokenKey).length;
	}
	if (element.tagName === "BR") {
		return 1;
	}
	let total = 0;
	element.childNodes.forEach((child) => {
		total += getNodeLogicalLength(child);
	});
	return total;
};

const getLogicalOffsetForBoundary = (
	root: HTMLElement,
	boundaryContainer: Node,
	boundaryOffset: number,
): number | null => {
	let total = 0;
	let found = false;

	const walk = (node: Node): boolean => {
		if (node === boundaryContainer) {
			if (node.nodeType === Node.TEXT_NODE) {
				const textLength = node.textContent?.length ?? 0;
				total += Math.min(boundaryOffset, textLength);
			} else {
				const childNodes = node.childNodes;
				const maxOffset = Math.min(boundaryOffset, childNodes.length);
				for (let i = 0; i < maxOffset; i += 1) {
					total += getNodeLogicalLength(childNodes[i]);
				}
			}
			found = true;
			return true;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			total += node.textContent?.length ?? 0;
			return false;
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const element = node as HTMLElement;
			const tokenKey = element.dataset.dynamicTokenKey;
			if (tokenKey) {
				total += getDynamicTokenString(tokenKey).length;
				return false;
			}
			for (const child of Array.from(node.childNodes)) {
				if (walk(child)) {
					return true;
				}
			}
		}

		return false;
	};

	walk(root);
	return found ? total : null;
};

const getLogicalSelectionRange = (root: HTMLElement) => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return null;
	}
	const range = selection.getRangeAt(0);
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
		return null;
	}

	const start = getLogicalOffsetForBoundary(
		root,
		range.startContainer,
		range.startOffset,
	);
	const end = getLogicalOffsetForBoundary(root, range.endContainer, range.endOffset);
	if (start === null || end === null) {
		return null;
	}
	return {
		start: Math.min(start, end),
		end: Math.max(start, end),
	};
};

const setLogicalCaretOffset = (root: HTMLElement, offset: number) => {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	let remaining = Math.max(0, offset);

	const placeAtEnd = () => {
		range.selectNodeContents(root);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	};

	const walk = (node: Node): boolean => {
		if (node.nodeType === Node.TEXT_NODE) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) {
				range.setStart(node, remaining);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
				return true;
			}
			remaining -= length;
			return false;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return false;
		}

		const element = node as HTMLElement;
		const tokenKey = element.dataset.dynamicTokenKey;
		if (tokenKey) {
			const tokenLength = getDynamicTokenString(tokenKey).length;
			if (remaining <= tokenLength) {
				const parent = element.parentNode;
				if (!parent) return false;
				const tokenIndex = Array.prototype.indexOf.call(parent.childNodes, element);
				range.setStart(parent, remaining === 0 ? tokenIndex : tokenIndex + 1);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
				return true;
			}
			remaining -= tokenLength;
			return false;
		}

		for (const child of Array.from(element.childNodes)) {
			if (walk(child)) {
				return true;
			}
		}

		return false;
	};

	if (!walk(root)) {
		placeAtEnd();
	}
};

const serializeEditorValue = (root: HTMLElement): string => {
	const walk = (node: Node): string => {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.textContent ?? "";
		}
		if (node.nodeType !== Node.ELEMENT_NODE) {
			return "";
		}
		const element = node as HTMLElement;
		const tokenKey = element.dataset.dynamicTokenKey;
		if (tokenKey) {
			return getDynamicTokenString(tokenKey);
		}
		if (element.tagName === "BR") {
			return "\n";
		}
		return Array.from(element.childNodes).map(walk).join("");
	};

	return Array.from(root.childNodes)
		.map(walk)
		.join("")
		.replace(/\u00a0/g, " ")
		.replace(/\u200b/g, "");
};

const normalizeEditorValue = (value: string, multiline: boolean) => {
	if (multiline) return value;
	return value.replace(/\r?\n/g, " ");
};

const getDeleteRange = (
	value: string,
	cursor: number,
	forward: boolean,
): { start: number; end: number } => {
	if (forward) {
		if (cursor >= value.length) {
			return { start: cursor, end: cursor };
		}
		const tokenMatch = /^\{\{[A-Za-z0-9_-]+\}\}/.exec(value.slice(cursor));
		const deleteCount = tokenMatch ? tokenMatch[0].length : 1;
		return { start: cursor, end: cursor + deleteCount };
	}

	if (cursor <= 0) {
		return { start: 0, end: 0 };
	}
	const before = value.slice(0, cursor);
	const tokenMatch = /\{\{[A-Za-z0-9_-]+\}\}$/.exec(before);
	const deleteCount = tokenMatch ? tokenMatch[0].length : 1;
	return { start: cursor - deleteCount, end: cursor };
};

const DynamicTokenizedEditor = ({
	value,
	placeholders,
	dynamicSources,
	multiline = false,
	placeholder,
	rows = 3,
	onSelectDynamicSource,
	onChange,
	insertTokenHandlerRef,
}: {
	value: string;
	placeholders: EmailTemplatePlaceholder[];
	dynamicSources: DynamicSourceField[];
	multiline?: boolean;
	placeholder?: string;
	rows?: number;
	onSelectDynamicSource: (source: DynamicSourceField) => EmailTemplatePlaceholder;
	onChange: (value: string) => void;
	insertTokenHandlerRef?: MutableRefObject<((key: string) => void) | null>;
}) => {
	const editorRef = useRef<HTMLDivElement | null>(null);
	const pendingCaretOffsetRef = useRef<number | null>(null);
	const latestValueRef = useRef<string>(value);
	const skipNextInputRef = useRef<boolean>(false);
	const skipNextBeforeInputInsertRef = useRef<boolean>(false);
	const dynamicSourcesByKey = useMemo(() => {
		const lookup = new Map<string, DynamicSourceField>();
		dynamicSources.forEach((source) => {
			lookup.set(source.placeholderKey.toLowerCase(), source);
		});
		return lookup;
	}, [dynamicSources]);
	const availableSources = useMemo<DynamicSourceOption[]>(() => {
		return buildAvailableDynamicSourceOptions(dynamicSources);
	}, [dynamicSources]);

	useEffect(() => {
		latestValueRef.current = value;
	}, [value]);

	const handleSetValue = useCallback((nextValue: string, nextCaretOffset?: number) => {
		pendingCaretOffsetRef.current = nextCaretOffset ?? null;
		const normalized = normalizeEditorValue(nextValue, multiline);
		latestValueRef.current = normalized;
		onChange(normalized);
	}, [onChange, multiline]);

	const insertTextAtCurrentSelection = useCallback((text: string) => {
		const root = editorRef.current;
		const selection = root ? getLogicalSelectionRange(root) : null;
		const currentValue = latestValueRef.current;
		const start = selection?.start ?? currentValue.length;
		const end = selection?.end ?? start;
		const nextValue = currentValue.slice(0, start) + text + currentValue.slice(end);
		handleSetValue(nextValue, start + text.length);
	}, [handleSetValue]);

	useEffect(() => {
		if (!insertTokenHandlerRef) return;
		insertTokenHandlerRef.current = (key: string) => {
			const root = editorRef.current;
			const token = getDynamicTokenString(key);
			const selection = root ? getLogicalSelectionRange(root) : null;
			const currentValue = latestValueRef.current;
			const start = selection?.start ?? currentValue.length;
			const end = selection?.end ?? start;
			const nextValue = currentValue.slice(0, start) + token + currentValue.slice(end);
			handleSetValue(nextValue, start + token.length);
			requestAnimationFrame(() => {
				const editor = editorRef.current;
				if (!editor) return;
				editor.focus();
				if (pendingCaretOffsetRef.current !== null) {
					setLogicalCaretOffset(editor, pendingCaretOffsetRef.current);
				}
			});
		};
		return () => {
			insertTokenHandlerRef.current = null;
		};
	}, [insertTokenHandlerRef, handleSetValue]);

	useLayoutEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		const pendingOffset = pendingCaretOffsetRef.current;
		if (pendingOffset === null) return;
		if (document.activeElement !== editor) return;
		setLogicalCaretOffset(editor, pendingOffset);
		pendingCaretOffsetRef.current = null;
	}, [value]);

	const handleInput = useCallback((event: FormEvent<HTMLDivElement>) => {
		if (skipNextInputRef.current) {
			skipNextInputRef.current = false;
			return;
		}
		const root = event.currentTarget;
		const selection = getLogicalSelectionRange(root);
		const nextValue = serializeEditorValue(root);
		handleSetValue(nextValue, selection?.end ?? nextValue.length);
	}, [handleSetValue]);

	const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault();
		const pastedText = event.clipboardData.getData("text/plain") ?? "";
		const root = editorRef.current;
		const selection = root ? getLogicalSelectionRange(root) : null;
		const currentValue = latestValueRef.current;
		const start = selection?.start ?? currentValue.length;
		const end = selection?.end ?? start;
		const nextValue = currentValue.slice(0, start) + pastedText + currentValue.slice(end);
		handleSetValue(nextValue, start + pastedText.length);
	}, [handleSetValue]);

	const handleCut = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
		const root = editorRef.current;
		if (!root) return;
		const selection = getLogicalSelectionRange(root);
		if (!selection || selection.start === selection.end) {
			return;
		}
		event.preventDefault();
		const currentValue = latestValueRef.current;
		const selectedText = currentValue.slice(selection.start, selection.end);
		event.clipboardData.setData("text/plain", selectedText);
		handleSetValue(
			currentValue.slice(0, selection.start) + currentValue.slice(selection.end),
			selection.start,
		);
	}, [handleSetValue]);

	const handleBeforeInput = useCallback((event: FormEvent<HTMLDivElement>) => {
		const nativeEvent = event.nativeEvent as InputEvent;
		const inputType = nativeEvent.inputType;
		if (!inputType) {
			return;
		}

		const root = event.currentTarget;
		const selection = getLogicalSelectionRange(root);
		const currentValue = latestValueRef.current;
		const start = selection?.start ?? currentValue.length;
		const end = selection?.end ?? start;
		const hasSelection = start !== end;

		const commit = (nextValue: string, caretOffset: number) => {
			event.preventDefault();
			skipNextInputRef.current = true;
			handleSetValue(nextValue, caretOffset);
		};

		if (inputType === "insertText" || inputType === "insertReplacementText") {
			if (skipNextBeforeInputInsertRef.current) {
				skipNextBeforeInputInsertRef.current = false;
				event.preventDefault();
				return;
			}
			const inserted = nativeEvent.data ?? "";
			if (!inserted) return;
			commit(
				currentValue.slice(0, start) + inserted + currentValue.slice(end),
				start + inserted.length,
			);
			return;
		}

		if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
			event.preventDefault();
			if (!multiline) return;
			handleSetValue(
				currentValue.slice(0, start) + "\n" + currentValue.slice(end),
				start + 1,
			);
			return;
		}

		if (inputType === "deleteByCut") {
			if (!hasSelection) return;
			commit(
				currentValue.slice(0, start) + currentValue.slice(end),
				start,
			);
			return;
		}

		if (inputType === "deleteContentBackward") {
			if (hasSelection) {
				commit(
					currentValue.slice(0, start) + currentValue.slice(end),
					start,
				);
				return;
			}
			const range = getDeleteRange(currentValue, start, false);
			if (range.start === range.end) {
				event.preventDefault();
				return;
			}
			commit(
				currentValue.slice(0, range.start) + currentValue.slice(range.end),
				range.start,
			);
			return;
		}

		if (inputType === "deleteContentForward") {
			if (hasSelection) {
				commit(
					currentValue.slice(0, start) + currentValue.slice(end),
					start,
				);
				return;
			}
			const range = getDeleteRange(currentValue, start, true);
			if (range.start === range.end) {
				event.preventDefault();
				return;
			}
			commit(
				currentValue.slice(0, range.start) + currentValue.slice(range.end),
				range.start,
			);
			return;
		}

		if (inputType === "insertFromDrop" || inputType === "deleteByDrag") {
			event.preventDefault();
		}
	}, [multiline, handleSetValue]);

	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		const root = editorRef.current;
		const selection = root ? getLogicalSelectionRange(root) : null;
		const currentValue = latestValueRef.current;
		const start = selection?.start ?? currentValue.length;
		const end = selection?.end ?? start;
		const hasSelection = start !== end;

		if (event.key === "Enter") {
			event.preventDefault();
			if (!multiline) return;
			const nextValue = currentValue.slice(0, start) + "\n" + currentValue.slice(end);
			handleSetValue(nextValue, start + 1);
			return;
		}

		if (
			event.key.length === 1 &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey
		) {
			event.preventDefault();
			skipNextBeforeInputInsertRef.current = true;
			insertTextAtCurrentSelection(event.key);
			return;
		}

		// When there's a selection, always intercept Delete/Backspace and handle in React-space.
		// Letting the browser natively delete React-managed token <span> nodes causes a
		// removeChild reconciliation crash because React still holds refs to those DOM nodes.
		if ((event.key === "Delete" || event.key === "Backspace") && hasSelection) {
			event.preventDefault();
			handleSetValue(currentValue.slice(0, start) + currentValue.slice(end), start);
			return;
		}

		// No selection: intercept to ensure whole tokens are deleted atomically.
		if (event.key === "Delete" && !hasSelection) {
			event.preventDefault();
			const range = getDeleteRange(currentValue, start, true);
			if (range.start === range.end) return;
			handleSetValue(currentValue.slice(0, range.start) + currentValue.slice(range.end), range.start);
			return;
		}

		if (event.key === "Backspace" && !hasSelection) {
			event.preventDefault();
			const range = getDeleteRange(currentValue, start, false);
			if (range.start === range.end) return;
			handleSetValue(currentValue.slice(0, range.start) + currentValue.slice(range.end), range.start);
			return;
		}
	}, [multiline, handleSetValue, insertTextAtCurrentSelection]);

	const parts = useMemo(() => {
		const parsed: ReactNode[] = [];
		let lastIndex = 0;
		const regex = /\{\{([A-Za-z0-9_-]+)\}\}/g;

		for (const match of value.matchAll(regex)) {
			const startIndex = match.index ?? 0;
			if (startIndex > lastIndex) {
				parsed.push(
					<span
						key={`text-${startIndex}`}
						className={multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"}
					>
						{value.slice(lastIndex, startIndex)}
					</span>
				);
			}

			const key = match[1];
			const sourceLabel = formatDynamicLabel(key, placeholders, dynamicSourcesByKey);
			parsed.push(
				<DynamicSourceTokenMenu
					key={`token-${key}-${startIndex}`}
					tokenKey={key}
					sourceLabel={sourceLabel}
					availableSources={availableSources}
					onSelectSource={(source) => {
						const selectedKey = source.key;
						if (source.dynamicSource) {
							onSelectDynamicSource(source.dynamicSource);
						}
						const nextValue = replaceDynamicTokenAt(value, key, selectedKey, startIndex);
						const nextOffset = startIndex + getDynamicTokenString(selectedKey).length;
						handleSetValue(nextValue, nextOffset);
					}}
					onRemoveSource={() => {
						const nextValue = removeDynamicTokenAt(value, key, startIndex);
						handleSetValue(nextValue, startIndex);
					}}
				/>
			);
			lastIndex = startIndex + match[0].length;
		}

		if (lastIndex < value.length) {
			parsed.push(
				<span
					key="text-tail"
					className={multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre"}
				>
					{value.slice(lastIndex)}
				</span>
			);
		}

		return parsed;
	}, [
		value,
		placeholders,
		dynamicSourcesByKey,
		availableSources,
		multiline,
		onSelectDynamicSource,
		handleSetValue,
	]);

	return (
		<div
			ref={editorRef}
			contentEditable
			suppressContentEditableWarning
			data-placeholder={placeholder ?? ""}
			className={[
				"w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm leading-5 outline-none ring-offset-background",
				"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				"empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
				multiline ? "min-h-20 whitespace-pre-wrap" : "min-h-9 whitespace-pre flex flex-wrap items-center",
			].join(" ")}
			style={multiline ? { minHeight: `${Math.max(rows, 3) * 1.4}rem` } : undefined}
			onInput={handleInput}
			onBeforeInput={handleBeforeInput}
			onPaste={handlePaste}
			onCut={handleCut}
			onDrop={(event) => event.preventDefault()}
			onKeyDown={handleKeyDown}
			onBlur={() => {
				pendingCaretOffsetRef.current = null;
			}}
		>
			{parts.length > 0 ? parts : null}
		</div>
	);
};

type PlaceholderInsertButtonProps = {
	placeholders: EmailTemplatePlaceholder[];
	dynamicSources: DynamicSourceField[];
	onSelectDynamicSource: (source: DynamicSourceField) => EmailTemplatePlaceholder;
	onInsert: (key: string) => void;
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

const PlaceholderInsertButton = ({
	placeholders,
	dynamicSources,
	onSelectDynamicSource,
	onInsert,
	onAddPlaceholder,
}: PlaceholderInsertButtonProps) => {
	const handleInsert = useCallback((key: string) => {
		onInsert(key);
	}, [onInsert]);
	const availableSources = useMemo<DynamicSourceOption[]>(() => {
		return buildAvailableDynamicSourceOptions(dynamicSources);
	}, [dynamicSources]);

	return (
		<DynamicSourceInsertMenu
			availableSources={availableSources}
			placeholders={placeholders.map((placeholder) => ({
				id: placeholder.id,
				key: placeholder.key,
				label: placeholder.label,
			}))}
			startAtCategoryList
			onSelectSource={(source) => {
				if (source.dynamicSource) {
					const placeholder = onSelectDynamicSource(source.dynamicSource);
					handleInsert(placeholder.key);
					return;
				}
				handleInsert(source.key);
			}}
			onInsertPlaceholder={handleInsert}
			onCreatePlaceholder={onAddPlaceholder}
		/>
	);
};

type PlaceholderTextareaFieldProps = {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	rows?: number;
	placeholders: EmailTemplatePlaceholder[];
	dynamicSources: DynamicSourceField[];
	onSelectDynamicSource: (source: DynamicSourceField) => EmailTemplatePlaceholder;
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

const PlaceholderTextareaField = ({
	label,
	value,
	onChange,
	rows = 3,
	placeholders,
	dynamicSources,
	onSelectDynamicSource,
	invalidPlaceholders,
	onAddPlaceholder,
}: PlaceholderTextareaFieldProps) => {
	const insertTokenHandlerRef = useRef<((key: string) => void) | null>(null);
	const handleInsert = (key: string) => {
		if (insertTokenHandlerRef.current) {
			insertTokenHandlerRef.current(key);
			return;
		}
		onChange(`${value}${getDynamicTokenString(key)}`);
	};
	return (
		<div className="space-y-2">
			{invalidPlaceholders && invalidPlaceholders.length > 0 && (
				<Alert variant="destructive" className="text-xs">
					<AlertCircle className="h-3.5 w-3.5" />
					<AlertTitle className="text-xs font-semibold">Invalid placeholder patterns detected</AlertTitle>
					<AlertDescription className="text-xs">
						<p className="mb-1.5">The template contains empty placeholder patterns like <code className="rounded bg-background px-1 py-0.5 text-[10px]">{"{{}}"}</code> that must be fixed before saving.</p>
					</AlertDescription>
				</Alert>
			)}
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<PlaceholderInsertButton
					placeholders={placeholders}
					dynamicSources={dynamicSources}
					onSelectDynamicSource={onSelectDynamicSource}
					onAddPlaceholder={onAddPlaceholder}
					onInsert={handleInsert}
				/>
			</div>
			<DynamicTokenizedEditor
				value={value}
				placeholders={placeholders}
				dynamicSources={dynamicSources}
				multiline
				rows={rows}
				onSelectDynamicSource={onSelectDynamicSource}
				onChange={onChange}
				insertTokenHandlerRef={insertTokenHandlerRef}
			/>
		</div>
	);
};

type PlaceholderInputFieldProps = {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	placeholders: EmailTemplatePlaceholder[];
	dynamicSources: DynamicSourceField[];
	onSelectDynamicSource: (source: DynamicSourceField) => EmailTemplatePlaceholder;
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
	placeholder?: string;
};

const PlaceholderInputField = ({
	label,
	value,
	onChange,
	placeholders,
	dynamicSources,
	onSelectDynamicSource,
	invalidPlaceholders,
	onAddPlaceholder,
	placeholder: inputPlaceholder,
}: PlaceholderInputFieldProps) => {
	const insertTokenHandlerRef = useRef<((key: string) => void) | null>(null);
	const handleInsert = (key: string) => {
		if (insertTokenHandlerRef.current) {
			insertTokenHandlerRef.current(key);
			return;
		}
		onChange(`${value}${getDynamicTokenString(key)}`);
	};
	return (
		<div className="space-y-2">
			{invalidPlaceholders && invalidPlaceholders.length > 0 && (
				<Alert variant="destructive" className="text-xs">
					<AlertCircle className="h-3.5 w-3.5" />
					<AlertTitle className="text-xs font-semibold">Invalid placeholder patterns detected</AlertTitle>
					<AlertDescription className="text-xs">
						<p className="mb-1.5">The template contains empty placeholder patterns like <code className="rounded bg-background px-1 py-0.5 text-[10px]">{"{{}}"}</code> that must be fixed before saving.</p>
					</AlertDescription>
				</Alert>
			)}
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<PlaceholderInsertButton
					placeholders={placeholders}
					dynamicSources={dynamicSources}
					onSelectDynamicSource={onSelectDynamicSource}
					onAddPlaceholder={onAddPlaceholder}
					onInsert={handleInsert}
				/>
			</div>
			<DynamicTokenizedEditor
				value={value}
				placeholders={placeholders}
				dynamicSources={dynamicSources}
				placeholder={inputPlaceholder}
				onSelectDynamicSource={onSelectDynamicSource}
				onChange={onChange}
				insertTokenHandlerRef={insertTokenHandlerRef}
			/>
		</div>
	);
};

export function EmailBlockProperties({
	block,
	onChange,
	onDelete,
	onOpenImagePicker,
	placeholders,
	dynamicSources,
	onSelectDynamicSource,
	invalidPlaceholders,
	onAddPlaceholder,
}: EmailBlockPropertiesProps) {
  const { t } = useTranslation();

  if (!block) {
    return (
      <Card className="h-full border-none bg-card/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t("emailDesigner.properties.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("emailDesigner.properties.empty")}
        </CardContent>
      </Card>
    );
  }

  const renderTypographyControls = () => {
    // Elements that support typography
    const supportsTypography = ["subject", "preheader", "text", "button", "navigation", "footerText", "unsubscribe"].includes(block.type);
    if (!supportsTypography) return null;
    
    // Type guard to ensure typography exists
    const blockWithTypography = block as Extract<EmailTemplateBlock, { typography?: EmailTypography }>;
    const typography = (blockWithTypography.typography || getDefaultTypography());
    
    if (!typography) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.typography")}
          </Label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontSize")}</Label>
                <Input
                  type="number"
                  min={10}
                  max={72}
                  value={typography.fontSize}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontSize: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontWeight")}</Label>
                <Select
                  value={typography.fontWeight}
                  onValueChange={(value: "normal" | "400" | "500" | "600" | "700" | "bold") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontWeight: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="400">400</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="600">600</SelectItem>
                    <SelectItem value="700">700</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.lineHeight")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={3}
                  step={0.1}
                  value={typography.lineHeight}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, lineHeight: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.letterSpacing")}</Label>
                <Input
                  type="number"
                  min={-2}
                  max={5}
                  step={0.1}
                  value={typography.letterSpacing}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, letterSpacing: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.textColor")}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={typography.color || "#000000"}
                  onChange={(e) => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, color: e.target.value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8 w-16"
                />
                <Input
                  value={typography.color || ""}
                  onChange={(e) => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, color: e.target.value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  placeholder="#000000"
                  className="h-8 flex-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontStyle")}</Label>
                <Select
                  value={typography.fontStyle}
                  onValueChange={(value: "normal" | "italic") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontStyle: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.textDecoration")}</Label>
                <Select
                  value={typography.textDecoration}
                  onValueChange={(value: "none" | "underline" | "line-through") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, textDecoration: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="line-through">Line Through</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpacingControls = () => {
    // Elements that support spacing
    const supportsSpacing = ["subject", "preheader", "text", "button", "divider", "image", "logo", "navigation", "footerText", "socialLinks", "unsubscribe", "spacer", "paymentInstructions"].includes(block.type);
    const spacing = supportsSpacing
      ? (block.spacing || getDefaultSpacing())
      : null;
    
    if (!spacing) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.spacing")}
          </Label>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-2 block">{t("emailDesigner.properties.padding")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Top</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingTop}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingTop: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Right</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingRight}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingRight: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bottom</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingBottom}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingBottom: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Left</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingLeft}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingLeft: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">{t("emailDesigner.properties.margin")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Top</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginTop}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginTop: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Right</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginRight}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginRight: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bottom</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginBottom}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginBottom: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Left</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginLeft}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginLeft: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBorderControls = () => {
    // Elements that support borders
    const supportsBorder = ["subject", "preheader", "text", "button", "image", "logo", "navigation", "footerText", "socialLinks", "divider", "paymentInstructions"].includes(block.type);
    if (!supportsBorder) return null;
    
    // Type guard to ensure border exists
    const blockWithBorder = block as Extract<EmailTemplateBlock, { border?: EmailBorder }>;
    const border = (blockWithBorder.border || getDefaultBorder());
    
    if (!border) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.border")}
          </Label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.borderWidth")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={border.borderWidth}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value, false);
                    const updated = { ...block, border: { ...border, borderWidth: parsed } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.borderRadius")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={border.borderRadius}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value, false);
                    if (parsed !== undefined) {
                      const updated = { ...block, border: { ...border, borderRadius: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }
                  }}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.borderColor")}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={border.borderColor}
                  onChange={(e) => {
                    const updated = { ...block, border: { ...border, borderColor: e.target.value } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8 w-16"
                />
                <Input
                  value={border.borderColor}
                  onChange={(e) => {
                    const updated = { ...block, border: { ...border, borderColor: e.target.value } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  placeholder="#e5e7eb"
                  className="h-8 flex-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.borderStyle")}</Label>
              <Select
                value={border.borderStyle}
                onValueChange={(value: "solid" | "dashed" | "dotted") => {
                  const updated = { ...block, border: { ...border, borderStyle: value } };
                  onChange(updated as EmailTemplateBlock);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">{t("emailDesigner.properties.solid")}</SelectItem>
                  <SelectItem value="dashed">{t("emailDesigner.properties.dashed")}</SelectItem>
                  <SelectItem value="dotted">{t("emailDesigner.properties.dotted")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBackgroundColorControls = () => {
    // Elements that support background color
    const supportsBackground = ["subject", "preheader", "text", "button", "image", "logo", "navigation", "footerText", "socialLinks", "unsubscribe", "spacer", "divider", "paymentInstructions"].includes(block.type);
    
    if (!supportsBackground) return null;

    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={(block as Extract<EmailTemplateBlock, { backgroundColor?: string }>).backgroundColor || "#ffffff"}
            onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
            className="h-8 w-16"
          />
          <Input
            value={(block as Extract<EmailTemplateBlock, { backgroundColor?: string }>).backgroundColor || ""}
            onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
            placeholder="transparent"
            className="h-8 flex-1"
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full border-none bg-card/80 shadow-none flex flex-col py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 shrink-0 px-6 py-3">
        <CardTitle className="text-lg font-semibold">
          {block.type === "paymentInstructions"
            ? t("emailDesigner.blocks.paymentInstructions", "Payment Instructions")
            : t(`emailDesigner.blocks.${block.type}` as const)}
        </CardTitle>
        <Button variant="destructive" size="sm" onClick={() => onDelete(block.id)}>
          {t("emailDesigner.properties.delete")}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Content/Base Properties */}
            {(block.type === "subject" || block.type === "preheader") && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={block.content}
									onChange={(value) => onChange({ ...block, content: value })}
									rows={3}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}
            {block.type === "text" && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={block.content}
									onChange={(value) => onChange({ ...block, content: value })}
									rows={4}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={block.align}
                    onValueChange={(value: "left" | "center" | "right" | "justify") =>
                      onChange({ ...block, align: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="emphasizeToggle">{t("emailDesigner.properties.emphasize")}</Label>
                  <Switch
                    id="emphasizeToggle"
                    checked={block.emphasize}
                    onCheckedChange={(checked) => onChange({ ...block, emphasize: checked })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "button" && (
              <>
                <PlaceholderInputField
									label={t("emailDesigner.properties.label")}
									value={block.label}
									onChange={(value) => onChange({ ...block, label: value })}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <PlaceholderInputField
									label={t("emailDesigner.properties.url")}
									value={block.url}
									onChange={(value) => onChange({ ...block, url: value })}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.variant")}</Label>
                    <Select
                      value={block.variant}
                      onValueChange={(value: "primary" | "secondary" | "link") =>
                        onChange({ ...block, variant: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">{t("emailDesigner.properties.primary")}</SelectItem>
                        <SelectItem value="secondary">{t("emailDesigner.properties.secondary")}</SelectItem>
                        <SelectItem value="link">{t("emailDesigner.properties.link")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.buttonWidth")}</Label>
                    <Select
                      value={block.buttonWidth || "auto"}
                      onValueChange={(value: "auto" | "full") =>
                        onChange({ ...block, buttonWidth: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="full">Full Width</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.buttonHeight")}</Label>
                    <Input
                      type="number"
                      min={32}
                      max={64}
                      value={block.buttonHeight || 44}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        if (parsed !== undefined) {
                          onChange({ ...block, buttonHeight: parsed });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#2563eb"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="#2563eb"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "divider" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.style")}</Label>
                    <Select
                      value={block.style}
                      onValueChange={(value: "solid" | "dashed" | "dotted") => onChange({ ...block, style: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">{t("emailDesigner.properties.solid")}</SelectItem>
                        <SelectItem value="dashed">{t("emailDesigner.properties.dashed")}</SelectItem>
                        <SelectItem value="dotted">{t("emailDesigner.properties.dotted")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align || "center"}
                      onValueChange={(value: "left" | "center" | "right") => onChange({ ...block, align: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.dividerWidth")} ({block.dividerWidth || 100}%)</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[block.dividerWidth || 100]}
                      onValueChange={([value]) => onChange({ ...block, dividerWidth: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.lineWidth")} ({block.width || 1}px)</Label>
                    <Slider
                      min={1}
                      max={8}
                      step={1}
                      value={[block.width || 1]}
                      onValueChange={([value]) => onChange({ ...block, width: value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.color")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.color || "#e5e7eb"}
                      onChange={(e) => onChange({ ...block, color: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.color || ""}
                      onChange={(e) => onChange({ ...block, color: e.target.value })}
                      placeholder="#e5e7eb"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "spacer" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.height")}: {block.height}px</Label>
                  <Slider
                    min={8}
                    max={128}
                    step={1}
                    value={[block.height]}
                    onValueChange={([value]) => onChange({ ...block, height: value })}
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
              </>
            )}

            {block.type === "image" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.imageUrl")}</Label>
						<div className="relative">
							<Input
								type="url"
								value={block.src}
								onChange={(e) => onChange({ ...block, src: e.target.value })}
								className={onOpenImagePicker ? "pr-24" : undefined}
								placeholder="https://"
							/>
							{onOpenImagePicker && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={() => onOpenImagePicker(block.id)}
									className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
								>
									{t("emailDesigner.properties.chooseImage")}
								</Button>
							)}
						</div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.altText")}</Label>
                  <Input
                    value={block.alt || ""}
                    onChange={(e) => onChange({ ...block, alt: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.width")}</Label>
                    <Input
                      type="number"
                      min={24}
                      max={600}
                      value={block.width}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        if (parsed !== undefined) {
                          onChange({ ...block, width: parsed });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.aspectRatio")}</Label>
                  <Select
                    value={block.aspectRatio || "auto"}
                    onValueChange={(value: "auto" | "1:1" | "16:9" | "4:3" | "3:2" | "21:9" | "custom") =>
                      onChange({ ...block, aspectRatio: value, ...(value !== "custom" ? { aspectRatioCustom: undefined } : {}) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("emailDesigner.properties.aspectRatioAuto")}</SelectItem>
                      <SelectItem value="1:1">{t("emailDesigner.properties.aspectRatio1_1")}</SelectItem>
                      <SelectItem value="16:9">{t("emailDesigner.properties.aspectRatio16_9")}</SelectItem>
                      <SelectItem value="4:3">{t("emailDesigner.properties.aspectRatio4_3")}</SelectItem>
                      <SelectItem value="3:2">{t("emailDesigner.properties.aspectRatio3_2")}</SelectItem>
                      <SelectItem value="21:9">{t("emailDesigner.properties.aspectRatio21_9")}</SelectItem>
                      <SelectItem value="custom">{t("emailDesigner.properties.aspectRatioCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {block.aspectRatio === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.aspectRatioCustomValue")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={block.aspectRatioCustom || 1}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value);
                        onChange({ ...block, aspectRatioCustom: parsed });
                      }}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("emailDesigner.properties.aspectRatioCustomHint")}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.borderRadius")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={block.borderRadius || 0}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      if (parsed !== undefined) {
                        onChange({ ...block, borderRadius: parsed });
                      }
                    }}
                  />
                </div>
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "logo" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.imageUrl")}</Label>
                  <div className="relative">
                    <Input
                      type="url"
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).src}
                      onChange={(e) => onChange({ ...block, src: e.target.value } as EmailTemplateBlock)}
                      className={onOpenImagePicker ? "pr-24" : undefined}
                      placeholder="https://"
                    />
                    {onOpenImagePicker && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenImagePicker(block.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                      >
                        {t("emailDesigner.properties.chooseImage")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.altText")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).alt || ""}
                    onChange={(e) => onChange({ ...block, alt: e.target.value } as EmailTemplateBlock)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.width")}</Label>
                    <Input
                      type="number"
                      min={24}
                      max={300}
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).width}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        onChange({ ...block, width: parsed } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.aspectRatio")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatio || "auto"}
                    onValueChange={(value: "auto" | "1:1" | "16:9" | "4:3" | "3:2" | "21:9" | "custom") =>
                      onChange({ ...block, aspectRatio: value, ...(value !== "custom" ? { aspectRatioCustom: undefined } : {}) } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("emailDesigner.properties.aspectRatioAuto")}</SelectItem>
                      <SelectItem value="1:1">{t("emailDesigner.properties.aspectRatio1_1")}</SelectItem>
                      <SelectItem value="16:9">{t("emailDesigner.properties.aspectRatio16_9")}</SelectItem>
                      <SelectItem value="4:3">{t("emailDesigner.properties.aspectRatio4_3")}</SelectItem>
                      <SelectItem value="3:2">{t("emailDesigner.properties.aspectRatio3_2")}</SelectItem>
                      <SelectItem value="21:9">{t("emailDesigner.properties.aspectRatio21_9")}</SelectItem>
                      <SelectItem value="custom">{t("emailDesigner.properties.aspectRatioCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatio === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.aspectRatioCustomValue")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatioCustom || 1}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value);
                        onChange({ ...block, aspectRatioCustom: parsed } as EmailTemplateBlock);
                      }}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("emailDesigner.properties.aspectRatioCustomHint")}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.link")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).link || ""}
                    onChange={(e) => onChange({ ...block, link: e.target.value } as EmailTemplateBlock)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.borderRadius")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).borderRadius || 0}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      if (parsed !== undefined) {
                        onChange({ ...block, borderRadius: parsed } as EmailTemplateBlock);
                      }
                    }}
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "navigation" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.navigationLinks")}</Label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("emailDesigner.properties.navigationLinksHint")}
                  </div>
                  <div className="space-y-2">
                    {((block as Extract<EmailTemplateBlock, { type: "navigation" }>).links || []).map((link: { label: string; url: string }, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          placeholder={t("emailDesigner.properties.linkLabel")}
                          value={link.label}
                          onChange={(e) => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = [...(navBlock.links || [])];
                            updatedLinks[idx] = { ...link, label: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder={t("emailDesigner.properties.url")}
                          value={link.url}
                          onChange={(e) => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = [...(navBlock.links || [])];
                            updatedLinks[idx] = { ...link, url: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = (navBlock.links || []).filter((_: { label: string; url: string }, i: number) => i !== idx);
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                        onChange({ ...block, links: [...(navBlock.links || []), { label: "", url: "" }] } as EmailTemplateBlock);
                      }}
                    >
                      + {t("emailDesigner.properties.addLink")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "navigation" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "footerText" && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).content}
									onChange={(value) =>
										onChange({ ...block, content: value } as EmailTemplateBlock)
									}
									rows={4}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
                      className="h-8 w-16"
                    />
                    <Input
                      value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "socialLinks" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.socialLinks")}</Label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("emailDesigner.properties.socialLinksHint")}
                  </div>
                  <div className="space-y-2">
                    {((block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).links || []).map((link, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Select
                          value={link.platform}
                          onValueChange={(value: "facebook" | "twitter" | "instagram" | "linkedin" | "youtube" | "custom") => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = [...(socialBlock.links || [])];
                            updatedLinks[idx] = { ...link, platform: value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder={t("emailDesigner.properties.url")}
                          value={link.url}
                          onChange={(e) => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = [...(socialBlock.links || [])];
                            updatedLinks[idx] = { ...link, url: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = (socialBlock.links || []).filter((_: { platform: string; url: string; icon?: string }, i: number) => i !== idx);
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                        onChange({ ...block, links: [...(socialBlock.links || []), { platform: "custom", url: "" }] } as EmailTemplateBlock);
                      }}
                    >
                      + {t("emailDesigner.properties.addLink")}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.iconSize")}</Label>
                    <Input
                      type="number"
                      min={16}
                      max={48}
                      value={(block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).iconSize || 24}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        onChange({ ...block, iconSize: parsed } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "unsubscribe" && (
              <>
                <PlaceholderInputField
									label={t("emailDesigner.properties.text")}
									value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).text}
									onChange={(value) =>
										onChange({ ...block, text: value } as EmailTemplateBlock)
									}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <PlaceholderInputField
									label={t("emailDesigner.properties.url")}
									value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).url}
									onChange={(value) =>
										onChange({ ...block, url: value } as EmailTemplateBlock)
									}
									placeholders={placeholders}
									dynamicSources={dynamicSources}
									onSelectDynamicSource={onSelectDynamicSource}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "paymentInstructions" && (
              <>
                <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-900">
                    {t("emailDesigner.paymentInstructions.title", "Smart Payment Instructions")}
                  </AlertTitle>
                  <AlertDescription className="text-blue-800">
                    {t(
                      "emailDesigner.paymentInstructions.description",
                      "This block auto-renders online payment, fallback bank instructions, and paid/cancelled states during preview/send.",
                    )}
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.paymentInstructions.ctaLabel", "Online CTA label")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "paymentInstructions" }>).ctaLabel}
                    onChange={(e) =>
                      onChange({ ...block, ctaLabel: e.target.value } as EmailTemplateBlock)
                    }
                    placeholder={t("emailDesigner.paymentInstructions.ctaPlaceholder", "Pay now")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.paymentInstructions.fallbackMode", "Fallback mode")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "paymentInstructions" }>).fallbackMode || "bank_transfer"}
                    onValueChange={(value: "bank_transfer" | "minimal") =>
                      onChange({ ...block, fallbackMode: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">
                        {t("emailDesigner.paymentInstructions.fallbackBank", "Bank transfer details")}
                      </SelectItem>
                      <SelectItem value="minimal">
                        {t("emailDesigner.paymentInstructions.fallbackMinimal", "Minimal fallback message")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="smart-payment-show-reference">
                    {t("emailDesigner.paymentInstructions.showReference", "Show payment reference")}
                  </Label>
                  <Switch
                    id="smart-payment-show-reference"
                    checked={(block as Extract<EmailTemplateBlock, { type: "paymentInstructions" }>).showReference ?? true}
                    onCheckedChange={(checked) =>
                      onChange({ ...block, showReference: checked } as EmailTemplateBlock)
                    }
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "columns" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.columnCount")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "columns" }>).columnCount || "2"}
                    onValueChange={(value: "2" | "3" | "4") => {
                      const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
                      const newCount = parseInt(value);
                      const currentColumns = colsBlock.columns || [];
                      const newColumns = Array.from({ length: newCount }, (_, i) => {
                        if (i < currentColumns.length) {
                          return { ...currentColumns[i], width: 100 / newCount };
                        }
                        return {
                          id: crypto.randomUUID(),
                          width: 100 / newCount,
                          blocks: [],
                        };
                      });
                      onChange({
                        ...block,
                        columnCount: value,
                        columns: newColumns.slice(0, newCount),
                      } as EmailTemplateBlock);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">{t("emailDesigner.properties.twoColumns")}</SelectItem>
                      <SelectItem value="3">{t("emailDesigner.properties.threeColumns")}</SelectItem>
                      <SelectItem value="4">{t("emailDesigner.properties.fourColumns")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.gap")}: {(block as Extract<EmailTemplateBlock, { type: "columns" }>).gap || 16}px</Label>
                  <Slider
                    min={0}
                    max={48}
                    step={4}
                    value={[(block as Extract<EmailTemplateBlock, { type: "columns" }>).gap || 16]}
                    onValueChange={([value]) => onChange({ ...block, gap: value } as EmailTemplateBlock)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "columns" }>).align || "left"}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("emailDesigner.properties.stackOnMobile")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "columns" }>).stackOnMobile ?? true}
                      onCheckedChange={(checked) =>
                        onChange({ ...block, stackOnMobile: checked } as EmailTemplateBlock)
                      }
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.columns")}</Label>
	                  {(block as Extract<EmailTemplateBlock, { type: "columns" }>).columns.map((column, colIdx) => (
	                    <div key={column.id} className="p-3 border rounded-md space-y-2">
	                      <div className="flex items-center justify-between">
	                        <Label className="text-xs">{t("emailDesigner.properties.column")} {colIdx + 1}</Label>
	                        <span className="text-xs text-muted-foreground">{column.blocks?.length || 0} {t("emailDesigner.properties.blocks")}</span>
	                      </div>
	                      <p className="text-[11px] text-muted-foreground">
	                        {t("emailDesigner.properties.nestedViaSidebar")}
	                      </p>
	                    </div>
	                  ))}
	                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

	            {block.type === "container" && (
	              <>
	                <div className="space-y-2">
	                  <Label>{t("emailDesigner.properties.direction")}</Label>
	                  <Select
	                    value={(block as Extract<EmailTemplateBlock, { type: "container" }>).layoutDirection || "vertical"}
	                    onValueChange={(value: "vertical" | "horizontal") =>
	                      onChange({ ...block, layoutDirection: value } as EmailTemplateBlock)
	                    }
	                  >
	                    <SelectTrigger>
	                      <SelectValue />
	                    </SelectTrigger>
	                    <SelectContent>
	                      <SelectItem value="vertical">{t("emailDesigner.properties.directionVertical")}</SelectItem>
	                      <SelectItem value="horizontal">{t("emailDesigner.properties.directionHorizontal")}</SelectItem>
	                    </SelectContent>
	                  </Select>
	                </div>
	                <div className="grid grid-cols-2 gap-3">
	                  <div className="space-y-2">
	                    <Label>{t("emailDesigner.properties.maxWidth")}</Label>
                    <Select
                      value={String((block as Extract<EmailTemplateBlock, { type: "container" }>).maxWidth || 600)}
                      onValueChange={(value) =>
                        onChange({ ...block, maxWidth: parseInt(value) as 520 | 600 | 680 | 800 } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="520">520px</SelectItem>
                        <SelectItem value="600">600px</SelectItem>
                        <SelectItem value="680">680px</SelectItem>
                        <SelectItem value="800">800px</SelectItem>
                      </SelectContent>
	                    </Select>
	                  </div>
	                  <div className="space-y-2">
	                    <Label>{t("emailDesigner.properties.position")}</Label>
	                    <Select
	                      value={(block as Extract<EmailTemplateBlock, { type: "container" }>).align || "center"}
	                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
	                    </Select>
	                  </div>
	                </div>
	                <div className="grid grid-cols-2 gap-3">
	                  <div className="space-y-2">
	                    <Label>{t("emailDesigner.properties.alignment")}</Label>
	                    <Select
	                      value={(block as Extract<EmailTemplateBlock, { type: "container" }>).contentAlign || "left"}
	                      onValueChange={(value: "left" | "center" | "right") =>
	                        onChange({ ...block, contentAlign: value } as EmailTemplateBlock)
	                      }
	                    >
	                      <SelectTrigger>
	                        <SelectValue />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
	                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
	                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
	                      </SelectContent>
	                    </Select>
	                  </div>
	                  <div className="space-y-2">
	                    <Label>{t("emailDesigner.properties.justify")}</Label>
	                    <Select
	                      value={(block as Extract<EmailTemplateBlock, { type: "container" }>).justifyContent || "start"}
	                      onValueChange={(value: "start" | "center" | "end" | "space-between") =>
	                        onChange({ ...block, justifyContent: value } as EmailTemplateBlock)
	                      }
	                    >
	                      <SelectTrigger>
	                        <SelectValue />
	                      </SelectTrigger>
	                      <SelectContent>
	                        <SelectItem value="start">{t("emailDesigner.properties.justifyStart")}</SelectItem>
	                        <SelectItem value="center">{t("emailDesigner.properties.justifyCenter")}</SelectItem>
	                        <SelectItem value="end">{t("emailDesigner.properties.justifyEnd")}</SelectItem>
	                        <SelectItem value="space-between">{t("emailDesigner.properties.justifySpaceBetween")}</SelectItem>
	                      </SelectContent>
	                    </Select>
	                  </div>
	                </div>
	                <div className="space-y-2">
	                  <Label>
	                    {t("emailDesigner.properties.gap")}:{" "}
	                    {(block as Extract<EmailTemplateBlock, { type: "container" }>).gap ?? 16}px
	                  </Label>
	                  <Slider
	                    min={0}
	                    max={48}
	                    step={2}
	                    value={[(block as Extract<EmailTemplateBlock, { type: "container" }>).gap ?? 16]}
	                    onValueChange={([value]) => onChange({ ...block, gap: value } as EmailTemplateBlock)}
	                  />
	                </div>
	                <div className="space-y-2">
	                  <Label>{t("emailDesigner.properties.padding")}</Label>
	                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "container" }>).padding || "md"}
                    onValueChange={(value: "none" | "xs" | "sm" | "md" | "lg") =>
                      onChange({ ...block, padding: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("emailDesigner.properties.paddingNone")}</SelectItem>
                      <SelectItem value="xs">{t("emailDesigner.properties.paddingXS")}</SelectItem>
                      <SelectItem value="sm">{t("emailDesigner.properties.paddingSM")}</SelectItem>
                      <SelectItem value="md">{t("emailDesigner.properties.paddingMD")}</SelectItem>
                      <SelectItem value="lg">{t("emailDesigner.properties.paddingLG")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.nestedBlocks")}</Label>
	                  <div className="p-3 border rounded-md space-y-2">
	                    <div className="flex items-center justify-between">
	                      <span className="text-xs text-muted-foreground">
	                        {(block as Extract<EmailTemplateBlock, { type: "container" }>).blocks?.length || 0} {t("emailDesigner.properties.blocks")}
	                      </span>
	                    </div>
	                    <p className="text-[11px] text-muted-foreground">
	                      {t("emailDesigner.properties.nestedViaSidebar")}
	                    </p>
	                  </div>
	                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

                        {block.type === "table" &&
              (() => {
                const tableBlock = block as EmailTableBlock;
                const dataSourceValue = tableBlock.dataSource || "";
                const selectedDataSourcePreset = EMAIL_TABLE_DATA_SOURCE_PRESETS.some(
                  (preset) => preset.value === dataSourceValue,
                )
                  ? dataSourceValue
                  : EMAIL_TABLE_CUSTOM_OPTION;

                const updateTableBlock = (updates: Partial<EmailTableBlock>) => {
                  onChange({
                    ...tableBlock,
                    ...updates,
                  } as EmailTemplateBlock);
                };

                const updateTableColumn = (columnId: string, updates: Partial<EmailTableColumn>) => {
                  updateTableBlock({
                    columns:
                      tableBlock.columns?.map((column) =>
                        column.id === columnId ? { ...column, ...updates } : column,
                      ) || [],
                  });
                };

                return (
                  <>
                    <div className="space-y-2">
                      <Label>{t("emailDesigner.properties.dataSource", "Items Binding")}</Label>
                      <Select
                        value={selectedDataSourcePreset}
                        onValueChange={(value) => {
                          if (value === EMAIL_TABLE_CUSTOM_OPTION) {
                            return;
                          }
                          updateTableBlock({ dataSource: value });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_TABLE_DATA_SOURCE_PRESETS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                              {preset.label}
                            </SelectItem>
                          ))}
                          <SelectItem value={EMAIL_TABLE_CUSTOM_OPTION}>
                            {t("emailDesigner.properties.customPath", "Custom path")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={dataSourceValue}
                        onChange={(e) => updateTableBlock({ dataSource: e.target.value })}
                        placeholder={t("emailDesigner.properties.dataSourcePlaceholder")}
                        className="h-8 text-xs font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("emailDesigner.properties.dataSourceHint")}
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {t("emailDesigner.properties.quickStart", "Quick setup")}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            updateTableBlock({
                              dataSource: "email.invoice.items",
                              columns: createInvoiceLineItemColumns(),
                            })
                          }
                        >
                          {t("emailDesigner.properties.useInvoiceLineItems", "Invoice line items")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            updateTableBlock({
                              dataSource: "products",
                              columns: createProductCatalogColumns(),
                            })
                          }
                        >
                          {t("emailDesigner.properties.useProductCatalog", "Product catalog")}
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">{t("emailDesigner.properties.columns")}</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const newColumn = createEmailTableColumn({
                              header: "New Column",
                              binding: "",
                              type: "text",
                              align: "left",
                              priority: "medium",
                              format: "none",
                            });
                            updateTableBlock({
                              columns: [...(tableBlock.columns || []), newColumn],
                            });
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("emailDesigner.properties.addColumn")}
                        </Button>
                      </div>
                      {tableBlock.columns?.map((column, colIdx) => {
                        const currentBinding = column.binding || "";
                        const selectedBindingPreset = EMAIL_TABLE_BINDING_OPTIONS.some(
                          (option) => option.value === currentBinding,
                        )
                          ? currentBinding
                          : EMAIL_TABLE_CUSTOM_OPTION;

                        return (
                          <div key={column.id} className="p-3 border rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">
                                {t("emailDesigner.properties.column")} {colIdx + 1}
                              </Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() =>
                                  updateTableBlock({
                                    columns:
                                      tableBlock.columns?.filter((c) => c.id !== column.id) || [],
                                  })
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <Label className="text-xs">{t("emailDesigner.properties.header")}</Label>
                                <Input
                                  value={column.header}
                                  onChange={(e) =>
                                    updateTableColumn(column.id, {
                                      header: e.target.value,
                                    })
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">{t("emailDesigner.properties.binding")}</Label>
                                <Select
                                  value={selectedBindingPreset}
                                  onValueChange={(value) => {
                                    if (value === EMAIL_TABLE_CUSTOM_OPTION) {
                                      if (!currentBinding) {
                                        updateTableColumn(column.id, { binding: "description" });
                                      }
                                      return;
                                    }
                                    updateTableColumn(column.id, { binding: value });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EMAIL_TABLE_BINDING_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value={EMAIL_TABLE_CUSTOM_OPTION}>
                                      {t("emailDesigner.properties.bindingCustom", "Custom field")}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {selectedBindingPreset === EMAIL_TABLE_CUSTOM_OPTION && (
                                  <Input
                                    value={currentBinding}
                                    onChange={(e) =>
                                      updateTableColumn(column.id, {
                                        binding: e.target.value,
                                      })
                                    }
                                    placeholder={t("emailDesigner.properties.bindingPlaceholder")}
                                    className="h-8 text-xs font-mono"
                                  />
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">{t("emailDesigner.properties.type")}</Label>
                                  <Select
                                    value={column.type}
                                    onValueChange={(value: "text" | "number" | "currency" | "badge") =>
                                      updateTableColumn(column.id, { type: value })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="text">{t("emailDesigner.properties.columnTypeText")}</SelectItem>
                                      <SelectItem value="number">{t("emailDesigner.properties.columnTypeNumber")}</SelectItem>
                                      <SelectItem value="currency">{t("emailDesigner.properties.columnTypeCurrency")}</SelectItem>
                                      <SelectItem value="badge">{t("emailDesigner.properties.columnTypeBadge")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">{t("emailDesigner.properties.alignment")}</Label>
                                  <Select
                                    value={column.align}
                                    onValueChange={(value: "left" | "center" | "right") =>
                                      updateTableColumn(column.id, { align: value })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {column.type === "currency" && (
                                <div>
                                  <Label className="text-xs">{t("emailDesigner.properties.currency")}</Label>
                                  <Input
                                    value={column.currency || "USD"}
                                    onChange={(e) =>
                                      updateTableColumn(column.id, {
                                        currency: e.target.value.toUpperCase().slice(0, 3),
                                      })
                                    }
                                    placeholder={t("emailDesigner.properties.currencyPlaceholder")}
                                    className="h-8 text-xs"
                                    maxLength={3}
                                  />
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">{t("emailDesigner.properties.priority")}</Label>
                                <Select
                                  value={column.priority}
                                  onValueChange={(value: "high" | "medium" | "low") =>
                                    updateTableColumn(column.id, { priority: value })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="high">{t("emailDesigner.properties.high")}</SelectItem>
                                    <SelectItem value="medium">{t("emailDesigner.properties.medium")}</SelectItem>
                                    <SelectItem value="low">{t("emailDesigner.properties.low")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      }) || (
                        <div className="p-3 border border-dashed rounded-md text-center text-sm text-muted-foreground">
                          {t("emailDesigner.properties.noColumns")}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>{t("emailDesigner.properties.emptyMessage")}</Label>
                      <Input
                        value={tableBlock.emptyMessage || t("emailDesigner.properties.emptyMessageDefault")}
                        onChange={(e) => updateTableBlock({ emptyMessage: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Separator />
                    <details className="group rounded-md border border-border/60 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                        {t("emailDesigner.properties.advancedTableSettings", "Advanced table settings")}
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">{t("emailDesigner.properties.styling")}</Label>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("emailDesigner.properties.borderStyle")}</Label>
                            <Select
                              value={tableBlock.style?.borderStyle || "light"}
                              onValueChange={(value: "none" | "light" | "strong") => {
                                updateTableBlock({
                                  style: {
                                    ...tableBlock.style,
                                    borderStyle: value,
                                  },
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t("emailDesigner.properties.none")}</SelectItem>
                                <SelectItem value="light">{t("emailDesigner.properties.light")}</SelectItem>
                                <SelectItem value="strong">{t("emailDesigner.properties.strong")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("emailDesigner.properties.paddingDensity")}</Label>
                            <Select
                              value={tableBlock.style?.paddingDensity || "comfortable"}
                              onValueChange={(value: "compact" | "comfortable" | "spacious") => {
                                updateTableBlock({
                                  style: {
                                    ...tableBlock.style,
                                    paddingDensity: value,
                                  },
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compact">{t("emailDesigner.properties.compact")}</SelectItem>
                                <SelectItem value="comfortable">{t("emailDesigner.properties.comfortable")}</SelectItem>
                                <SelectItem value="spacious">{t("emailDesigner.properties.spacious")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">{t("emailDesigner.properties.alternatingRows")}</Label>
                            <Switch
                              checked={tableBlock.style?.alternatingRows || false}
                              onCheckedChange={(checked) => {
                                updateTableBlock({
                                  style: {
                                    ...tableBlock.style,
                                    alternatingRows: checked,
                                  },
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">{t("emailDesigner.properties.showBorders")}</Label>
                            <Switch
                              checked={tableBlock.style?.showBorders !== false}
                              onCheckedChange={(checked) => {
                                updateTableBlock({
                                  style: {
                                    ...tableBlock.style,
                                    showBorders: checked,
                                  },
                                });
                              }}
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">{t("emailDesigner.properties.responsive")}</Label>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">{t("emailDesigner.properties.stackOnMobile")}</Label>
                            <Switch
                              checked={tableBlock.responsive?.stackOnMobile !== false}
                              onCheckedChange={(checked) => {
                                updateTableBlock({
                                  responsive: {
                                    ...tableBlock.responsive,
                                    stackOnMobile: checked,
                                  },
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">{t("emailDesigner.properties.hideLowPriorityColumns")}</Label>
                            <Switch
                              checked={tableBlock.responsive?.hideLowPriorityColumns !== false}
                              onCheckedChange={(checked) => {
                                updateTableBlock({
                                  responsive: {
                                    ...tableBlock.responsive,
                                    hideLowPriorityColumns: checked,
                                  },
                                });
                              }}
                            />
                          </div>
                        </div>
                        <Separator />
                        {renderBackgroundColorControls()}
                        <Separator />
                        {renderSpacingControls()}
                        <Separator />
                        {renderBorderControls()}
                      </div>
                    </details>
                  </>
                );
              })()}

          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

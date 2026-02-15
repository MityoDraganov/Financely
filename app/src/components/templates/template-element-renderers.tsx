/**
 * Element renderers for template preview
 * Each function renders a specific element type
 */

import React from "react";
import type { TemplateElement } from "@/core/entities/template";
import type { RenderPage } from "@/utils/template-pagination";
import { getByPath, formatValue } from "@/utils/template-preview-utils";
import type { IconName } from "lucide-react/dynamic";
import { DynamicIcon, normalizeIconName } from "@/components/designer/elements/lucide-icon-map";
import { getElementBorderRadiusCss, getElementPaddingCss } from "@/utils/element-box-model";
import { getTableGridTemplateColumns } from "@/utils/table-column-width";
import { getTableTextBehaviorStyles, normalizeTableTextBehavior } from "@/utils/table-text-behavior";
import { loadGoogleFonts } from "@/utils/google-fonts";

type InvoicePreviewContext = unknown;

type RenderContext = {
	context: InvoicePreviewContext;
	page: RenderPage;
	pageIndex: number;
	pageSize: { w: number; h: number };
	templateElements: TemplateElement[];
	margins: { top: number; right: number; bottom: number; left: number };
};

type ElementStyle = React.CSSProperties;

function getElementWrapperBackgroundColor(element: TemplateElement): string | undefined {
	if (element.type === "text") {
		return element.backgroundColor;
	}
	if (element.type === "icon") {
		if (element.shape && element.shape !== "none") {
			return undefined;
		}
		return element.backgroundColor;
	}
	return undefined;
}

/**
 * Calculate element position and style
 * Accounts for page margins - positions elements within usable area
 */
function calculateElementStyle(
	el: TemplateElement,
	adjustedY: number,
	pageIndex: number,
	pageSize: { w: number; h: number },
	margins: { top: number; right: number; bottom: number; left: number }
): ElementStyle {
	const usableHeight = pageSize.h - margins.top - margins.bottom;
	const pageStartY = pageIndex * usableHeight;
	const yInUsableArea = adjustedY - pageStartY;
	
	// Position relative to page, accounting for top margin
	const yOnPage = margins.top + yInUsableArea;
	
	const clampedX = Math.max(margins.left, Math.min(el.x, pageSize.w - margins.right));
	const clampedY = Math.max(margins.top, Math.min(yOnPage, pageSize.h - margins.bottom));
	const maxWidth = Math.max(0, pageSize.w - margins.right - clampedX);
	const maxHeight = Math.max(0, pageSize.h - margins.bottom - clampedY);
	const clampedWidth = Math.max(0, Math.min(el.width, maxWidth));
	const clampedHeight = Math.max(0, Math.min(el.height, maxHeight));
	
	return {
		position: "absolute",
		left: clampedX,
		top: clampedY,
		width: clampedWidth,
		height: clampedHeight,
		transform: `rotate(${el.rotation}deg)`,
		display: el.visible ? undefined : "none",
		zIndex: el.zIndex ?? 0,
		padding: getElementPaddingCss(el),
		backgroundColor: getElementWrapperBackgroundColor(el),
		borderRadius: getElementBorderRadiusCss(el),
		overflow: "hidden",
		boxSizing: "border-box",
	};
}

/**
 * Calculate adjusted Y position accounting for table expansion
 * This recalculates the same adjustment logic used in pagination
 * to ensure consistent positioning during rendering
 */
function calculateAdjustedY(
	el: TemplateElement,
	_templateElements: TemplateElement[],
	context: InvoicePreviewContext,
	pageSize: { w: number; h: number },
	margins: { top: number; right: number; bottom: number; left: number }
): number {
	let adjustedY = el.y;
	const usableHeight = pageSize.h - margins.top - margins.bottom;

	// Each page-break element forces a new page for subsequent content.
	_templateElements.forEach((otherEl) => {
		if (otherEl.type === "pageBreak" && otherEl.id !== el.id && otherEl.y <= el.y) {
			adjustedY += usableHeight;
		}
	});
	
	_templateElements.forEach((otherEl) => {
		if (otherEl.type === "table" && otherEl.id !== el.id) {
			const items = getByPath<Array<Record<string, unknown>>>(context, (otherEl as Extract<TemplateElement, { type: "table" }>).itemsBinding) || [];
			const headerHeight = (otherEl as Extract<TemplateElement, { type: "table" }>).headerHeight;
			const minRowHeight = (otherEl as Extract<TemplateElement, { type: "table" }>).rowHeight;
			const hasTotalingRow = (otherEl as Extract<TemplateElement, { type: "table" }>).columns.some((c) => c.showTotal);
			const totalingRowHeight = hasTotalingRow ? minRowHeight : 0;
			const actualHeight = headerHeight + (items.length * minRowHeight) + totalingRowHeight;
			// Original height is preview height (headerHeight + rowHeight)
			const originalHeight = headerHeight + minRowHeight;
			const heightDiff = actualHeight - originalHeight;
			
			if (heightDiff > 0) {
				const originalTableBottom = otherEl.y + originalHeight;
				if (el.y >= originalTableBottom) {
					adjustedY += heightDiff;
				}
			}
		}
	});
	
	return adjustedY;
}

/**
 * Render text element
 */
function renderTextElement(
	el: Extract<TemplateElement, { type: "text" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	loadGoogleFonts([el.typography.fontFamily]);
	let display = el.text ?? "";
	
	if (el.binding) {
		const bound = getByPath<unknown>(context, el.binding);
		display = el.format
			? formatValue(bound, el.format.kind, el.format.currency, el.format.dateFormat)
			: formatValue(bound, "none");
	}
	
	return (
		<div key={el.id} style={style}>
			<div
				style={{
					fontFamily: el.typography.fontFamily,
					fontSize: el.typography.fontSize,
					fontWeight: el.typography.fontWeight,
					lineHeight: el.typography.lineHeight,
					letterSpacing: el.typography.letterSpacing,
					color: el.typography.color,
					textAlign: el.typography.align,
					textTransform: el.typography.uppercase ? "uppercase" : el.typography.lowercase ? "lowercase" : undefined,
					whiteSpace: "pre-wrap",
					width: "100%",
					height: "100%",
					overflow: "hidden",
					wordWrap: "break-word",
					overflowWrap: "break-word",
					boxSizing: "border-box",
				}}
			>
				{display}
			</div>
		</div>
	);
}

/**
 * Render image element
 */
function renderImageElement(
	el: Extract<TemplateElement, { type: "image" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	let imageSrc = el.src;
	
	if (el.binding) {
		const boundValue = getByPath<string>(context, el.binding);
		if (boundValue) {
			imageSrc = boundValue;
		}
	}
	
	return (
		<div key={el.id} style={style}>
			{imageSrc ? (
				<img
					src={imageSrc}
					alt={el.alt || ""}
					style={{
						width: "100%",
						height: "100%",
						objectFit: el.objectFit,
						objectPosition: el.objectPosition,
						opacity: el.opacity ?? 1,
						border: el.border ? `${el.border.width}px ${el.border.style} ${el.border.color}` : undefined,
						borderRadius: el.border?.radius,
						boxShadow: el.shadow?.enabled
							? `${el.shadow.offsetX}px ${el.shadow.offsetY}px ${el.shadow.blur}px ${el.shadow.spread}px ${el.shadow.color}`
							: undefined,
						display: "block",
						maxWidth: "100%",
						maxHeight: "100%",
					}}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "#f3f4f6",
						color: "#6b7280",
						fontSize: 12,
						overflow: "hidden",
						boxSizing: "border-box",
					}}
				>
					No Image
				</div>
			)}
		</div>
	);
}

/**
 * Render box element
 */
function renderBoxElement(
	el: Extract<TemplateElement, { type: "box" }>,
	style: ElementStyle
): React.ReactNode {
	return (
		<div
			key={el.id}
			style={{
				...style,
				background: el.fill,
				border: `${el.strokeWidth}px solid ${el.stroke}`,
				borderRadius: el.radius,
			}}
		/>
	);
}

/**
 * Render line element
 */
function renderLineElement(
	el: Extract<TemplateElement, { type: "line" }>,
	style: ElementStyle
): React.ReactNode {
	return (
		<div key={el.id} style={style}>
			<div
				style={{
					borderTop: `${el.strokeWidth}px ${el.style || "solid"} ${el.stroke}`,
					position: "absolute",
					left: 0,
					right: 0,
					top: "50%",
					opacity: el.opacity ?? 1,
				}}
			/>
		</div>
	);
}

/**
 * Render icon element
 */
function renderIconElement(
	el: Extract<TemplateElement, { type: "icon" }>,
	style: ElementStyle
): React.ReactNode {
	const name = normalizeIconName(el.iconName) as IconName;
	return (
		<div key={el.id} style={style}>
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: el.color ?? "#111827",
				}}
			>
				<DynamicIcon name={name} style={{ width: "100%", height: "100%", minWidth: 16, minHeight: 16 }} />
			</div>
		</div>
	);
}

/**
 * Render input element
 */
function renderInputElement(
	el: Extract<TemplateElement, { type: "input" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	loadGoogleFonts([el.fontFamily || "Inter"]);
	const boundValue = el.binding ? getByPath<unknown>(context, el.binding) : undefined;
	const displayValue = boundValue != null ? formatValue(boundValue, "none") : "";
	const textAlign = el.align || "left";
	
	return (
		<div key={el.id} style={style}>
			<div
				style={{
					width: "100%",
					height: "100%",
					border: "1px solid #d1d5db",
					borderRadius: "4px",
					padding: "4px 8px",
					fontSize: 12,
					fontFamily: el.fontFamily || "Inter",
					color: displayValue ? "#111827" : "#9ca3af",
					backgroundColor: "#ffffff",
					display: "flex",
					alignItems: "center",
					textAlign,
					overflow: "hidden",
					boxSizing: "border-box",
				}}
			>
				{displayValue || el.placeholder || ""}
			</div>
		</div>
	);
}

/**
 * Render currency element
 */
function renderCurrencyElement(
	el: Extract<TemplateElement, { type: "currency" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	loadGoogleFonts([el.fontFamily || "Inter"]);
	const boundValue = el.binding ? getByPath<unknown>(context, el.binding) : undefined;
	
	let displayValue = "";
	if (boundValue != null) {
		const num = Number(boundValue);
		if (Number.isFinite(num)) {
			const currency = el.currency || "USD";
			const formatter = new Intl.NumberFormat(undefined, {
				style: "currency",
				currency,
			});
			displayValue = formatter.format(num);
		} else {
			displayValue = formatValue(boundValue, "none");
		}
	}
	
	const textAlign = el.align || "left";
	
	return (
		<div key={el.id} style={style}>
			<div
				style={{
					width: "100%",
					height: "100%",
					border: "1px solid #d1d5db",
					borderRadius: "4px",
					padding: "4px 8px",
					fontSize: 12,
					fontFamily: el.fontFamily || "Inter",
					color: displayValue ? "#111827" : "#9ca3af",
					backgroundColor: "#ffffff",
					display: "flex",
					alignItems: "center",
					gap: "4px",
					textAlign,
					overflow: "hidden",
					boxSizing: "border-box",
				}}
			>
				<span style={{ fontSize: 10, color: "#6b7280", fontWeight: 500 }}>
					{el.currency || "USD"}
				</span>
				<span style={{ flex: 1 }}>
					{displayValue || el.placeholder || "0.00"}
				</span>
			</div>
		</div>
	);
}

/**
 * Render table element
 */
function renderTableElement(
	el: Extract<TemplateElement, { type: "table" }>,
	style: ElementStyle,
	renderContext: RenderContext
): React.ReactNode {
	loadGoogleFonts([
		el.headerStyle?.fontFamily || "Inter",
		el.rowStyle?.fontFamily || "Inter",
		el.footerStyle?.fontFamily || "Inter",
	]);
	const { context, page } = renderContext;
	const allItems = getByPath<Array<Record<string, unknown>>>(context, el.itemsBinding) || [];
	
	const slice = page.tableSlices[el.id];
	const items = slice ? allItems.slice(slice.start, slice.end) : allItems;
	const showTotals = slice ? slice.isLastSlice : true;
	
	const headerHeight = el.headerHeight;
	const minRowHeight = el.rowHeight;
	const actualContentHeight = items.length * minRowHeight;
	const hasTotalingRow = el.columns.some((c) => c.showTotal) && showTotals;
	const totalingRowHeight = hasTotalingRow ? minRowHeight : 0;
	const totalTableHeight = headerHeight + actualContentHeight + totalingRowHeight;
	const headerTextBehavior = normalizeTableTextBehavior(el.headerStyle?.textBehavior, "wrap");
	const rowTextBehavior = normalizeTableTextBehavior(el.rowStyle?.textBehavior, "wrap");
	const headerTextStyle = getTableTextBehaviorStyles(headerTextBehavior);
	const rowTextStyle = getTableTextBehaviorStyles(rowTextBehavior);
	const normalizeTableFontWeight = (value: unknown): React.CSSProperties["fontWeight"] => {
		if (value === "semibold") return 600;
		if (value === "medium") return 500;
		if (value === "bold") return 700;
		return 400;
	};
	const headerTypographyStyle: React.CSSProperties = {
		fontFamily: el.headerStyle?.fontFamily || "Inter",
		fontSize: el.headerStyle?.fontSize || 10,
		fontWeight: normalizeTableFontWeight(el.headerStyle?.fontWeight),
		color: el.headerStyle?.color || "#374151",
	};
	const rowTypographyStyle: React.CSSProperties = {
		fontFamily: el.rowStyle?.fontFamily || "Inter",
		fontSize: el.rowStyle?.fontSize || 10,
		fontWeight: normalizeTableFontWeight(el.rowStyle?.fontWeight),
		color: el.rowStyle?.color || "#374151",
	};
	const headerIsMultiline = ["wrap", "break-words", "clamp"].includes(headerTextBehavior.mode);
	const rowIsMultiline = ["wrap", "break-words", "clamp"].includes(rowTextBehavior.mode);
	const headerOverflowVisible = ["wrap", "break-words"].includes(headerTextBehavior.mode);
	const rowOverflowVisible = ["wrap", "break-words"].includes(rowTextBehavior.mode);
	
	const tableStyle = { ...style, height: totalTableHeight, overflow: "visible" };
	
	return (
		<div key={el.id} style={tableStyle}>
			<div
				style={{
					width: "100%",
					height: "100%",
					fontSize: 10,
					color: "#374151",
					overflow: "visible",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* Header - show on all pages */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: getTableGridTemplateColumns(el.columns),
						borderBottom: "1px solid #e5e7eb",
						minHeight: el.headerHeight,
					}}
				>
					{el.columns.map((c) => (
						<div
							key={c.id}
							style={{
								display: "flex",
								alignItems: headerIsMultiline ? "flex-start" : "center",
								padding: "4px",
								fontWeight: 600,
								minWidth: 0,
								overflow: headerOverflowVisible ? "visible" : "hidden",
							}}
						>
							<span style={{ ...headerTextStyle, ...headerTypographyStyle }}>{c.header}</span>
						</div>
					))}
				</div>
				<div style={{ flex: 1, minHeight: 0, overflow: "visible" }}>
					{items.map((row, idx) => {
						const actualIdx = slice ? slice.start + idx : idx;
						return (
							<div
								key={actualIdx}
								style={{
									display: "grid",
									gridTemplateColumns: getTableGridTemplateColumns(el.columns),
									borderBottom:
										el.stripe && actualIdx % 2 === 1
											? "1px solid #f3f4f6"
											: "1px solid #e5e7eb",
									minHeight: el.rowHeight,
									padding: "4px 0",
								}}
							>
								{el.columns.map((c) => {
									const columnBinding = c.binding || c.id;
									const raw = getByPath<unknown>(row, columnBinding);
									
									let text: string;
									if (c.type === "currency") {
										if (raw != null) {
											const num = Number(raw);
											if (Number.isFinite(num)) {
												const currency = c.currency || c.format?.currency || "USD";
												const formatter = new Intl.NumberFormat(undefined, {
													style: "currency",
													currency,
												});
												text = formatter.format(num);
											} else {
												text = formatValue(raw, "none");
											}
										} else {
											text = "";
										}
									} else {
										text = formatValue(
											raw,
											c.format?.kind ?? "none",
											c.format?.currency,
											c.format?.dateFormat
										);
									}
									
									const justify =
										c.align === "right"
											? "flex-end"
											: c.align === "center"
												? "center"
												: "flex-start";
									
									return (
										<div
											key={c.id}
											style={{
												display: "flex",
												alignItems: rowIsMultiline ? "flex-start" : "center",
												justifyContent: justify,
												padding: "4px",
												minHeight: "20px",
												minWidth: 0,
												overflow: rowOverflowVisible ? "visible" : "hidden",
											}}
										>
											<span style={{ ...rowTextStyle, ...rowTypographyStyle }}>{text}</span>
										</div>
									);
								})}
							</div>
						);
					})}
					
					{/* Totaling Row - show only on last slice */}
					{hasTotalingRow && (
						<div
							style={{
								display: "grid",
								gridTemplateColumns: getTableGridTemplateColumns(el.columns),
								borderBottom: "1px solid #e5e7eb",
								minHeight: el.rowHeight,
							}}
						>
							{el.columns.map((c) => {
								let text = "";
								const cellStyle: React.CSSProperties = {
									display: "flex",
									alignItems: rowIsMultiline ? "flex-start" : "center",
									justifyContent:
										c.align === "right"
											? "flex-end"
											: c.align === "center"
												? "center"
												: "flex-start",
									padding: "4px",
									minWidth: 0,
									overflow: rowOverflowVisible ? "visible" : "hidden",
								};
								
								if (c.showTotal && (c.type === "number" || c.type === "currency")) {
									try {
										const columnBinding = c.binding || c.id;
										const columnValues = allItems
											.map((row) => {
												const val = getByPath<unknown>(row, columnBinding);
												if (val != null) {
													const num = Number(val);
													return Number.isFinite(num) ? num : 0;
												}
												return 0;
											})
											.filter((v) => typeof v === "number");
										
										const sum = columnValues.reduce((s, v) => s + v, 0);
										text = formatValue(
											sum,
											c.format?.kind ?? "none",
											c.currency || c.format?.currency,
											c.format?.dateFormat
										);
										
										if (c.totalStyle) {
											if (c.totalStyle.backgroundColor) {
												cellStyle.backgroundColor = c.totalStyle.backgroundColor;
											}
											if (c.totalStyle.color) {
												cellStyle.color = c.totalStyle.color;
											}
											if (c.totalStyle.fontWeight) {
												cellStyle.fontWeight = c.totalStyle.fontWeight;
											}
											if (c.totalStyle.fontSize) {
												cellStyle.fontSize = c.totalStyle.fontSize;
											}
											if (c.totalStyle.borderTop) {
												cellStyle.borderTop = c.totalStyle.borderTop;
											}
										} else {
											cellStyle.backgroundColor = "#f9fafb";
											cellStyle.fontWeight = "bold";
											cellStyle.borderTop = "2px solid #111827";
										}
									} catch (error) {
										console.error("Error calculating column total:", error);
										text = "";
									}
								}
								
								return (
									<div key={c.id} style={cellStyle}>
										<span style={{ ...rowTextStyle, ...rowTypographyStyle }}>{text}</span>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function renderSpacerElement(
	el: Extract<TemplateElement, { type: "spacer" }>,
	style: ElementStyle
): React.ReactNode {
	return (
		<div key={el.id} style={style}>
			{el.showDivider ? (
				<div
					style={{
						borderTopWidth: el.dividerWidth,
						borderTopStyle: el.dividerStyle,
						borderTopColor: el.dividerColor,
						width: "100%",
						position: "absolute",
						top: "50%",
						left: 0,
					}}
				/>
			) : null}
		</div>
	);
}

function renderQrCodeElement(
	el: Extract<TemplateElement, { type: "qrCode" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	const value = el.binding ? getByPath<string>(context, el.binding) || el.content : el.content;
	return (
		<div
			key={el.id}
			style={{
				...style,
				background: el.backgroundColor,
				color: el.foregroundColor,
				border: "1px solid #d1d5db",
				display: "grid",
				placeItems: "center",
				fontSize: 10,
				fontWeight: 700,
			}}
			title={value}
		>
			QR
		</div>
	);
}

function renderBarcodeElement(
	el: Extract<TemplateElement, { type: "barcode" }>,
	style: ElementStyle,
	context: InvoicePreviewContext
): React.ReactNode {
	const value = el.binding ? getByPath<string>(context, el.binding) || el.value : el.value;
	return (
		<div
			key={el.id}
			style={{
				...style,
				background: el.backgroundColor,
				color: el.color,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 4,
			}}
		>
			<div
				style={{
					width: "92%",
					height: "60%",
					backgroundImage: "repeating-linear-gradient(to right, currentColor 0, currentColor 2px, transparent 2px, transparent 4px)",
				}}
			/>
			{el.showText ? <div style={{ fontSize: 10, letterSpacing: 1 }}>{value || "BARCODE"}</div> : null}
		</div>
	);
}

function renderSignatureElement(
	el: Extract<TemplateElement, { type: "signature" }>,
	style: ElementStyle
): React.ReactNode {
	return (
		<div key={el.id} style={style}>
			<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
				{el.signatureType === "image" && el.signatureImage ? (
					<img src={el.signatureImage} alt="Signature" style={{ maxHeight: "70%", objectFit: "contain", objectPosition: "left bottom" }} />
				) : (
					<div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{el.placeholderText || "Signature"}</div>
				)}
				<div
					style={{
						borderBottomWidth: el.borderBottom?.width ?? 1,
						borderBottomStyle: el.borderBottom?.style ?? "solid",
						borderBottomColor: el.borderBottom?.color ?? "#111827",
					}}
				/>
			</div>
		</div>
	);
}

function renderStampElement(
	el: Extract<TemplateElement, { type: "stamp" }>,
	style: ElementStyle
): React.ReactNode {
	return (
		<div
			key={el.id}
			style={{
				...style,
				background: el.backgroundColor,
				color: el.textColor,
				opacity: el.opacity,
				borderRadius: el.shape === "circle" ? "9999px" : 8,
				border: el.border ? `${el.border.width}px ${el.border.style} ${el.border.color}` : "1px solid currentColor",
				fontFamily: el.fontFamily,
				fontWeight: el.fontWeight,
				fontSize: el.fontSize,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				textTransform: "uppercase",
			}}
		>
			{el.text}
		</div>
	);
}

/**
 * Render a template element
 */
export function renderTemplateElement(
	el: TemplateElement,
	renderContext: RenderContext
): React.ReactNode {
	const { context, pageIndex, pageSize, templateElements, margins } = renderContext;
	// page is accessed via renderContext in renderTableElement
	
	const adjustedY = calculateAdjustedY(el, templateElements, context, pageSize, margins);
	const style = calculateElementStyle(el, adjustedY, pageIndex, pageSize, margins);
	
	switch (el.type) {
		case "text":
			return renderTextElement(el, style, context);
		case "image":
			return renderImageElement(el, style, context);
		case "box":
			return renderBoxElement(el, style);
		case "line":
			return renderLineElement(el, style);
		case "icon":
			return renderIconElement(el, style);
		case "input":
			return renderInputElement(el, style, context);
		case "currency":
			return renderCurrencyElement(el, style, context);
		case "table":
			return renderTableElement(el, style, renderContext);
		case "spacer":
			return renderSpacerElement(el, style);
		case "pageBreak":
			return null;
		case "qrCode":
			return renderQrCodeElement(el, style, context);
		case "barcode":
			return renderBarcodeElement(el, style, context);
		case "signature":
			return renderSignatureElement(el, style);
		case "stamp":
			return renderStampElement(el, style);
		default:
			return null;
	}
}

import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProductSelector } from "./product-selector";
import { formatCurrency } from "@/utils/currencies";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Product } from "@/core/entities/product";
import type { TemplateElement } from "@/core";
import { useState, useEffect, useRef } from "react";

interface TableColumn {
	id: string;
	header: string;
	binding: string;
	type: "text" | "number" | "date" | "currency";
}

interface InvoiceTableRowProps {
	row: Record<string, InvoiceDataValue>;
	rowIndex: number;
	columns: TableColumn[];
	itemsPath: string;
	selectedProductId: string | undefined;
	products: Product[];
	onProductSelect: (productId: string | undefined) => void;
	onProductClear: () => void;
	isMapping: boolean;
	rowLockedFields: Set<string>;
	onCellChange: (binding: string, value: InvoiceDataValue) => void;
	onCellBlur: (binding: string, value: InvoiceDataValue) => void;
	selectedTemplate: { elements?: TemplateElement[] } | undefined;
	tableColumnCurrencyLinks: Map<
		string,
		Map<
			string,
			{
				sourceColumnBinding: string;
				link: unknown;
				column: { id: string; binding: string; currency?: string };
			}
		>
	>;
	defaultCurrency: string;
}

// Component for individual table cell input with cursor position preservation
function TableCellInput({
	cellKey,
	cellValue,
	col,
	itemsPath,
	rowIndex,
	isReadOnly,
	isQuantityField,
	hasStockTracking,
	availableStock,
	quantityExceedsStock,
	onChange,
	onBlur,
	columnDef,
	product,
	defaultCurrency,
}: {
	cellKey: string;
	cellValue: InvoiceDataValue;
	col: TableColumn;
	itemsPath: string;
	rowIndex: number;
	isReadOnly: boolean;
	isQuantityField: boolean;
	hasStockTracking: boolean;
	availableStock: number | undefined;
	quantityExceedsStock: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
	columnDef?: { currency?: string };
	product?: Product;
	defaultCurrency: string;
}) {
	const [localValue, setLocalValue] = useState<string>(() => {
		if (col.type === "number" || col.type === "currency") {
			if (cellValue === null || cellValue === undefined || cellValue === "") {
				return "";
			}
			if (typeof cellValue === "number") {
				return String(cellValue);
			}
			return String(cellValue);
		}
		return String(cellValue ?? "");
	});

	const inputRef = useRef<HTMLInputElement>(null);
	const previousValueRef = useRef<InvoiceDataValue>(cellValue);

	// Sync local value with prop value only when it changes externally
	useEffect(() => {
		if (cellValue !== previousValueRef.current) {
			const newDisplayValue = (() => {
				if (col.type === "number" || col.type === "currency") {
					if (cellValue === null || cellValue === undefined || cellValue === "") {
						return "";
					}
					if (typeof cellValue === "number") {
						return String(cellValue);
					}
					return String(cellValue);
				}
				return String(cellValue ?? "");
			})();

			// Preserve cursor position when updating from external source
			if (inputRef.current && document.activeElement === inputRef.current) {
				const cursorPosition = inputRef.current.selectionStart;
				setLocalValue(newDisplayValue);
				// Restore cursor position after state update
				setTimeout(() => {
					if (inputRef.current) {
						const newPosition = Math.min(cursorPosition ?? 0, newDisplayValue.length);
						inputRef.current.setSelectionRange(newPosition, newPosition);
					}
				}, 0);
			} else {
				setLocalValue(newDisplayValue);
			}
			previousValueRef.current = cellValue;
		}
	}, [cellValue, col.type]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		// Update local state immediately to preserve cursor position
		setLocalValue(inputValue);
		// Then call the parent handler
		onChange(e);
	};

	return (
		<Input
			ref={inputRef}
			id={`${itemsPath}-${rowIndex}-${col.binding}`}
			type={col.type === "currency" ? "number" : col.type}
			max={
				isQuantityField && hasStockTracking && availableStock !== undefined
					? availableStock
					: undefined
			}
			value={localValue}
			onChange={handleInputChange}
			onBlur={onBlur}
			placeholder={`Enter ${col.header.toLowerCase()}`}
			readOnly={isReadOnly}
			className={`${
				isReadOnly ? "bg-muted cursor-not-allowed" : ""
			} ${
				quantityExceedsStock
					? "border-red-500 focus-visible:ring-red-500"
					: ""
			}`}
		/>
	);
}

export function InvoiceTableRow({
	row,
	rowIndex,
	columns,
	itemsPath,
	selectedProductId,
	products,
	onProductSelect,
	onProductClear,
	isMapping,
	rowLockedFields,
	onCellChange,
	onCellBlur,
	selectedTemplate,
	tableColumnCurrencyLinks,
	defaultCurrency,
}: InvoiceTableRowProps) {
	const product = selectedProductId
		? products.find((p) => p.id === selectedProductId)
		: undefined;

	// Find table element and column definitions
	const tableEl = selectedTemplate?.elements?.find(
		(e) => e.type === "table" && (e as Extract<TemplateElement, { type: "table" }>).itemsBinding === itemsPath
	) as Extract<TemplateElement, { type: "table" }> | undefined;

	const tableLinks = tableColumnCurrencyLinks.get(itemsPath);

	const handleCellChange = (binding: string, e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		let val: InvoiceDataValue;

		const col = columns.find((c) => c.binding === binding);
		if (!col) return;

		if (col.type === "number" || col.type === "currency") {
			if (inputValue === "" || inputValue === null || inputValue === undefined) {
				val = "";
			} else {
				const trimmed = inputValue.trim();
				if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
					val = "";
				} else {
					const numValue = Number(trimmed);
					if (
						!isNaN(numValue) &&
						isFinite(numValue) &&
						trimmed === String(numValue)
					) {
						val = numValue;
					} else {
						val = trimmed;
					}
				}
			}
		} else {
			val = inputValue;
		}

		onCellChange(binding, val);
	};

	const handleCellBlur = (binding: string, e: React.FocusEvent<HTMLInputElement>) => {
		const col = columns.find((c) => c.binding === binding);
		if (!col) return;

		if (col.type === "number" || col.type === "currency") {
			const inputValue = e.target.value.trim();
			if (inputValue === "" || inputValue === "-" || inputValue === "." || inputValue === "-.") {
				onCellBlur(binding, "");
			} else {
				const numValue = Number(inputValue);
				if (!isNaN(numValue) && isFinite(numValue)) {
					onCellBlur(binding, numValue);
				} else if (inputValue !== "") {
					onCellBlur(binding, "");
				}
			}
		}
	};

	return (
		<div className="p-4 border rounded-lg space-y-3 bg-muted/20">
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-medium">Row {rowIndex + 1}</h4>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onProductClear}
					className="text-destructive hover:text-destructive"
				>
					Remove
				</Button>
			</div>

			{/* Product Selection */}
			{products.length > 0 && (
				<div className="space-y-2 pb-3 border-b">
					<Label>Select a product (optional)</Label>
					<div className="flex items-center gap-2">
						<ProductSelector
							products={products}
							value={selectedProductId}
							onValueChange={onProductSelect}
							placeholder="Select a product for this item..."
							className="flex-1"
						/>
						{selectedProductId && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onProductClear}
								disabled={isMapping}
							>
								Clear
							</Button>
						)}
					</div>
					{isMapping && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Mapping product data...</span>
						</div>
					)}
					{selectedProductId && !isMapping && (
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-xs">
								<span className="text-muted-foreground">
									{product ? product.name : "Unknown Product"}
								</span>
							</div>
							{rowLockedFields.size > 0 && (
								<div className="text-xs text-muted-foreground">
									<span className="font-medium">Mapped fields:</span>{" "}
									{Array.from(rowLockedFields)
										.map((field) => {
											const col = columns.find((c) => c.binding === field);
											return col ? col.header : field;
										})
										.join(", ")}
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Table Cells */}
			<div className="grid gap-3 sm:grid-cols-2">
				{columns.map((col) => {
					const isLinkedColumn = tableLinks?.has(col.binding) || false;
					const columnDef = tableEl?.columns?.find((c) => c.id === col.id);
					const hasFormula =
						!!columnDef?.calc ||
						(columnDef?.type === "currency" &&
							"mode" in columnDef &&
							columnDef.mode === "formula" &&
							"formula" in columnDef &&
							!!columnDef.formula);

					const isQuantityFieldForLockCheck =
						col.binding === "quantity" || col.binding === "qty";
					const isProductLocked =
						!isQuantityFieldForLockCheck &&
						rowLockedFields.has(col.binding);
					const isReadOnly =
						isLinkedColumn || hasFormula || isProductLocked;

					const isQuantityField =
						col.binding === "quantity" || col.binding === "qty";
					const quantityValue = isQuantityField
						? (row[col.binding] as number | undefined)
						: undefined;
					const hasStockTracking =
						product?.trackInventory &&
						product?.stockQuantity !== undefined;
					const availableStock = hasStockTracking
						? (product.stockQuantity ?? 0)
						: undefined;
					const quantityExceedsStock =
						isQuantityField &&
						hasStockTracking &&
						availableStock !== undefined &&
						quantityValue !== undefined &&
						quantityValue > availableStock;

					const cellValue = row[col.binding];

					return (
						<div key={col.id} className="space-y-2">
							<div className="flex items-center gap-2">
								<Label
									htmlFor={`${itemsPath}-${rowIndex}-${col.binding}`}
								>
									{col.header}
									{isLinkedColumn && (
										<span className="ml-2 text-xs text-muted-foreground font-normal">
											(Linked - read-only)
										</span>
									)}
									{hasFormula && (
										<span className="ml-2 text-xs text-muted-foreground font-normal">
											(Formula - read-only)
										</span>
									)}
									{isProductLocked && (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-green-700">
														<CheckCircle2 className="h-3 w-3" />
													</div>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<div className="space-y-1">
														<p className="font-medium">
															Field populated from product
														</p>
														{product && (
															<div className="text-xs space-y-0.5">
																<p>
																	<strong>Product:</strong> {product.name}
																</p>
																{product.sku && (
																	<p>
																		<strong>SKU:</strong> {product.sku}
																	</p>
																)}
																<p>
																	<strong>Value:</strong>{" "}
																	{col.type === "currency" || col.type === "number"
																		? typeof cellValue === "number"
																			? formatCurrency(
																					cellValue,
																					col.type === "currency" && columnDef?.currency
																						? columnDef.currency
																						: product.currency || defaultCurrency
																				)
																			: String(cellValue || "")
																		: String(cellValue || "")}
																</p>
															</div>
														)}
													</div>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
									{isQuantityField &&
										hasStockTracking &&
										availableStock !== undefined && (
											<span className="ml-2 text-xs text-muted-foreground font-normal">
												(Available: {availableStock})
											</span>
										)}
								</Label>
							</div>
							<div className="relative">
								<TableCellInput
									cellKey={`${itemsPath}-${rowIndex}-${col.binding}`}
									cellValue={cellValue}
									col={col}
									itemsPath={itemsPath}
									rowIndex={rowIndex}
									isReadOnly={isReadOnly}
									isQuantityField={isQuantityField}
									hasStockTracking={hasStockTracking}
									availableStock={availableStock}
									quantityExceedsStock={quantityExceedsStock}
									onChange={(e) => handleCellChange(col.binding, e)}
									onBlur={(e) => handleCellBlur(col.binding, e)}
									columnDef={columnDef}
									product={product}
									defaultCurrency={defaultCurrency}
								/>
								{isProductLocked && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600 cursor-help">
													<CheckCircle2 className="h-3.5 w-3.5" />
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<p>
													This field is populated from the
													selected product
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
							{quantityExceedsStock &&
								availableStock !== undefined && (
									<div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
										<AlertCircle className="h-3.5 w-3.5 shrink-0" />
										<span>
											Quantity ({quantityValue}) exceeds
											available stock ({availableStock})
										</span>
									</div>
								)}
						</div>
					);
				})}
			</div>
		</div>
	);
}


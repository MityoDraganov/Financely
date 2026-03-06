import { Loader2, Trash2, Sparkles, Lock, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { cn } from "@/lib/utils";

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
	// New layout props for spreadsheet style
	gridTemplateColumns: string;
	hasProducts: boolean;
	onRemoveRow: () => void;
}

// Spreadsheet-cell input — borderless, expands to fill cell
function TableCellInput({
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
}: {
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
}) {
	const [localValue, setLocalValue] = useState<string>(() => {
		if (col.type === "number" || col.type === "currency") {
			if (cellValue === null || cellValue === undefined || cellValue === "")
				return "";
			return String(cellValue);
		}
		return String(cellValue ?? "");
	});

	const inputRef = useRef<HTMLInputElement>(null);
	const isUserTypingRef = useRef(false);

	useEffect(() => {
		if (isUserTypingRef.current) return;

		const newDisplayValue = (() => {
			if (col.type === "number" || col.type === "currency") {
				if (cellValue === null || cellValue === undefined || cellValue === "")
					return "";
				return String(cellValue);
			}
			return String(cellValue ?? "");
		})();

		if (newDisplayValue !== localValue) {
			if (inputRef.current && document.activeElement === inputRef.current) {
				const cursorPosition = inputRef.current.selectionStart;
				setLocalValue(newDisplayValue);
				setTimeout(() => {
					if (inputRef.current) {
						const newPosition = Math.min(
							cursorPosition ?? 0,
							newDisplayValue.length
						);
						inputRef.current.setSelectionRange(newPosition, newPosition);
					}
				}, 0);
			} else {
				setLocalValue(newDisplayValue);
			}
		}
	}, [cellValue, col.type, localValue]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		isUserTypingRef.current = true;
		setLocalValue(e.target.value);
		onChange(e);
		setTimeout(() => {
			isUserTypingRef.current = false;
		}, 100);
	};

	return (
		<input
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
			placeholder="—"
			readOnly={isReadOnly}
			className={cn(
				"inv-cell-input",
				isReadOnly && "cursor-default",
				quantityExceedsStock && "text-destructive"
			)}
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
	onProductClear: _onProductClear,
	isMapping,
	rowLockedFields,
	onCellChange,
	onCellBlur,
	selectedTemplate,
	tableColumnCurrencyLinks,
	defaultCurrency,
	gridTemplateColumns,
	hasProducts,
	onRemoveRow,
}: InvoiceTableRowProps) {
	const { t } = useTranslation();
	const product = selectedProductId
		? products.find((p) => p.id === selectedProductId)
		: undefined;

	const tableEl = selectedTemplate?.elements?.find(
		(e) =>
			e.type === "table" &&
			(e as Extract<TemplateElement, { type: "table" }>).itemsBinding ===
				itemsPath
	) as Extract<TemplateElement, { type: "table" }> | undefined;

	const tableLinks = tableColumnCurrencyLinks.get(itemsPath);

	const handleCellChange = (
		binding: string,
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const inputValue = e.target.value;
		let val: InvoiceDataValue;

		const col = columns.find((c) => c.binding === binding);
		if (!col) return;

		if (col.type === "number" || col.type === "currency") {
			if (inputValue === "" || inputValue === null || inputValue === undefined) {
				val = "";
			} else {
				const trimmed = inputValue.trim();
				if (
					trimmed === "" ||
					trimmed === "-" ||
					trimmed === "." ||
					trimmed === "-."
				) {
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

	const handleCellBlur = (
		binding: string,
		e: React.FocusEvent<HTMLInputElement>
	) => {
		const col = columns.find((c) => c.binding === binding);
		if (!col) return;

		if (col.type === "number" || col.type === "currency") {
			const inputValue = e.target.value.trim();
			if (
				inputValue === "" ||
				inputValue === "-" ||
				inputValue === "." ||
				inputValue === "-."
			) {
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
		<div
			className="inv-table-row inv-row-enter grid relative group hover:bg-muted/20 transition-colors"
			style={{ gridTemplateColumns }}
		>
			{/* Mapping overlay */}
			{isMapping && (
				<div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] flex items-center justify-center z-10">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
						{t("invoiceTableRow.mappingProduct")}
					</div>
				</div>
			)}

			{/* Product selector cell */}
			{hasProducts && (
				<div className="border-r border-border/50 flex items-center px-1.5 py-1 min-w-0">
					<ProductSelector
						products={products}
						value={selectedProductId}
						onValueChange={onProductSelect}
						placeholder={t("invoiceTableRow.productPlaceholder")}
						className="h-7 border-0 shadow-none bg-transparent text-xs px-1.5 hover:bg-muted/50 rounded-md"
					/>
				</div>
			)}

			{/* Data cells */}
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
					!isQuantityFieldForLockCheck && rowLockedFields.has(col.binding);
				const isReadOnly = isLinkedColumn || hasFormula || isProductLocked;

				const isQuantityField =
					col.binding === "quantity" || col.binding === "qty";
				const quantityValue = isQuantityField
					? (row[col.binding] as number | undefined)
					: undefined;
				const hasStockTracking = !!(
					product?.trackInventory &&
					product?.stockQuantity !== undefined
				);
				const availableStock = hasStockTracking
					? (product.stockQuantity ?? 0)
					: undefined;
				const quantityExceedsStock = !!(
					isQuantityField &&
					hasStockTracking &&
					availableStock !== undefined &&
					quantityValue !== undefined &&
					quantityValue > availableStock
				);

				const cellValue = row[col.binding];
				const isAutoField = isLinkedColumn || hasFormula;

				return (
					<TooltipProvider key={col.id}>
						<div
							className={cn(
								"relative border-r border-border/50 last:border-r-0",
								"focus-within:bg-primary/[0.03] transition-colors",
								isAutoField && "bg-muted/20",
								quantityExceedsStock &&
									"ring-1 ring-inset ring-destructive/40"
							)}
						>
							<TableCellInput
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
							/>

							{/* State badge — top-right of cell */}
							{(isAutoField || isProductLocked || quantityExceedsStock) && (
								<div className="absolute right-1 top-1 pointer-events-none">
									{quantityExceedsStock && (
										<Tooltip>
											<TooltipTrigger asChild>
												<AlertCircle className="h-3 w-3 text-destructive pointer-events-auto cursor-help" />
											</TooltipTrigger>
											<TooltipContent>
												<p className="text-xs">
													{t("invoiceTableRow.quantityExceedsStock", {
														quantity: quantityValue,
														stock: availableStock,
													})}
												</p>
											</TooltipContent>
										</Tooltip>
									)}
									{!quantityExceedsStock && isAutoField && (
										<Tooltip>
											<TooltipTrigger asChild>
												<Sparkles className="h-2.5 w-2.5 text-sky-400/60 pointer-events-auto cursor-help" />
											</TooltipTrigger>
											<TooltipContent>
												<p className="text-xs">
													{hasFormula
														? t("invoiceTableRow.autoCalculated")
														: t("invoiceTableRow.linkedAutoConverted")}
												</p>
												{hasFormula &&
													typeof cellValue === "number" && (
														<p className="text-xs font-medium mt-0.5">
															={" "}
															{formatCurrency(
																cellValue,
																columnDef?.type === "currency" &&
																"currency" in columnDef &&
																columnDef.currency
																	? (columnDef.currency as string)
																	: defaultCurrency
															)}
														</p>
													)}
											</TooltipContent>
										</Tooltip>
									)}
									{!quantityExceedsStock && !isAutoField && isProductLocked && (
										<Tooltip>
											<TooltipTrigger asChild>
												<Lock className="h-2.5 w-2.5 text-green-500/60 pointer-events-auto cursor-help" />
											</TooltipTrigger>
											<TooltipContent>
												<p className="text-xs">
													{t("invoiceTableRow.fromProduct")}
												</p>
												{product && (
													<p className="text-xs text-muted-foreground">
														{product.name}
													</p>
												)}
											</TooltipContent>
										</Tooltip>
									)}
								</div>
							)}

							{/* Stock hint */}
							{isQuantityField && hasStockTracking && availableStock !== undefined && !quantityExceedsStock && (
								<div className="absolute right-1 bottom-0.5 text-[9px] text-muted-foreground/50 pointer-events-none tabular-nums leading-none">
									/{availableStock}
								</div>
							)}
						</div>
					</TooltipProvider>
				);
			})}

			{/* Delete button cell */}
			<div className="flex items-center justify-center">
				<button
					type="button"
					onClick={onRemoveRow}
					className="inv-delete-btn p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
					aria-label={t("invoiceTableRow.removeRowAria")}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}

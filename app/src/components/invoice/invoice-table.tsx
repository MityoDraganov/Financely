import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceTableRow } from "./invoice-table-row";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Product } from "@/core/entities/product";
import type { TemplateElement } from "@/core";

interface TableColumn {
	id: string;
	header: string;
	binding: string;
	type: "text" | "number" | "date" | "currency";
}

interface TableConfig {
	itemsPath: string;
	columns: TableColumn[];
}

interface InvoiceTableProps {
	tableConfig: TableConfig;
	tableIndex: number;
	tableItems: Array<Record<string, InvoiceDataValue>>;
	products: Product[];
	selectedProducts: Map<string, string>;
	productLockedFields: Map<string, Set<string>>;
	mappingProducts: Set<string>;
	onAddRow: () => Promise<void>;
	onRemoveRow: (rowIndex: number) => Promise<void>;
	onProductSelect: (rowIndex: number, productId: string | undefined) => void;
	onProductClear: (rowIndex: number) => void;
	onCellChange: (
		rowIndex: number,
		binding: string,
		value: InvoiceDataValue
	) => void;
	onCellBlur: (
		rowIndex: number,
		binding: string,
		value: InvoiceDataValue
	) => void;
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

export function InvoiceTable({
	tableConfig,
	tableIndex,
	tableItems,
	products,
	selectedProducts,
	productLockedFields,
	mappingProducts,
	onAddRow,
	onRemoveRow,
	onProductSelect,
	onProductClear,
	onCellChange,
	onCellBlur,
	selectedTemplate,
	tableColumnCurrencyLinks,
	defaultCurrency,
}: InvoiceTableProps) {
	const tableLabel = tableConfig.itemsPath
		.split(".")
		.pop()!
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (c) => c.toUpperCase());

	const hasProducts = products.length > 0;

	// Build a consistent grid template for headers + rows
	const gridTemplateColumns = [
		...(hasProducts ? ["180px"] : []),
		...tableConfig.columns.map(() => "minmax(80px, 1fr)"),
		"36px",
	].join(" ");

	return (
		<div
			key={`table-${tableIndex}`}
			data-table-path={tableConfig.itemsPath}
			className="rounded-xl border overflow-hidden inv-slide-up"
		>
			{/* Table title bar */}
			<div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
					{tableLabel}
				</span>
				<span className="text-xs text-muted-foreground tabular-nums">
					{tableItems.length}{" "}
					{tableItems.length === 1 ? "row" : "rows"}
				</span>
			</div>

			<div className="overflow-x-auto">
				{/* Column headers */}
				<div
					className="grid min-w-full border-b bg-muted/10"
					style={{ gridTemplateColumns }}
				>
					{hasProducts && (
						<div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 border-r border-border/50">
							Product
						</div>
					)}
					{tableConfig.columns.map((col) => (
						<div
							key={col.id}
							className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 border-r border-border/50 last:border-r-0"
						>
							{col.header}
						</div>
					))}
					{/* Actions column header */}
					<div className="py-2" />
				</div>

				{/* Rows */}
				{tableItems.length === 0 ? (
					<div className="py-10 text-center">
						<p className="text-sm font-medium text-muted-foreground">
							No {tableLabel.toLowerCase()} yet
						</p>
						<p className="text-xs text-muted-foreground/60 mt-0.5">
							Click Add Row to get started
						</p>
					</div>
				) : (
					<div className="divide-y divide-border/50">
						{tableItems.map((row, rowIndex) => {
							const rowKey = `${tableConfig.itemsPath}-${rowIndex}`;
							const selectedProductId = selectedProducts.get(rowKey);
							const rowLockedFields =
								productLockedFields.get(rowKey) || new Set<string>();
							const isMapping = mappingProducts.has(rowKey);

							return (
								<InvoiceTableRow
									key={rowIndex}
									row={row}
									rowIndex={rowIndex}
									columns={tableConfig.columns}
									itemsPath={tableConfig.itemsPath}
									selectedProductId={selectedProductId}
									products={products}
									onProductSelect={(productId) =>
										onProductSelect(rowIndex, productId)
									}
									onProductClear={() => onProductClear(rowIndex)}
									isMapping={isMapping}
									rowLockedFields={rowLockedFields}
									onCellChange={(binding, value) =>
										onCellChange(rowIndex, binding, value)
									}
									onCellBlur={(binding, value) =>
										onCellBlur(rowIndex, binding, value)
									}
									selectedTemplate={selectedTemplate}
									tableColumnCurrencyLinks={tableColumnCurrencyLinks}
									defaultCurrency={defaultCurrency}
									gridTemplateColumns={gridTemplateColumns}
									hasProducts={hasProducts}
									onRemoveRow={() => onRemoveRow(rowIndex)}
								/>
							);
						})}
					</div>
				)}
			</div>

			{/* Add row footer */}
			<div className="px-3 py-2 border-t bg-muted/10">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onAddRow}
					className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
				>
					<Plus className="h-3.5 w-3.5" />
					Add Row
				</Button>
			</div>
		</div>
	);
}

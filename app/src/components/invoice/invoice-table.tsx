import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	onCellChange: (rowIndex: number, binding: string, value: InvoiceDataValue) => void;
	onCellBlur: (rowIndex: number, binding: string, value: InvoiceDataValue) => void;
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

	return (
		<Card key={`table-${tableIndex}`} data-table-path={tableConfig.itemsPath}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>{tableLabel}</CardTitle>
					<Button type="button" variant="outline" size="sm" onClick={onAddRow}>
						<Plus className="mr-2 h-4 w-4" />
						Add Row
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{tableItems.length === 0 ? (
					<div className="text-center py-6 text-muted-foreground">
						<p>No {tableLabel.toLowerCase()} added yet.</p>
						<p className="text-sm">Click "Add Row" to get started.</p>
					</div>
				) : (
					<div className="space-y-3">
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
								/>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}


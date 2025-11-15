import { useCallback } from "react";
import type { InvoiceDataValue } from "@/core/entities/invoice";

interface TableColumn {
	id: string;
	header: string;
	binding: string;
	type: "text" | "number" | "date" | "currency";
}

interface UseInvoiceTableHandlersProps {
	setValue: (path: string, value: InvoiceDataValue) => Promise<void>;
	getValue: (path: string) => InvoiceDataValue;
	updateTableCell: (
		itemsPath: string,
		rowIndex: number,
		binding: string,
		value: InvoiceDataValue
	) => void;
}

export function useInvoiceTableHandlers({
	setValue,
	getValue,
	updateTableCell,
}: UseInvoiceTableHandlersProps) {
	const addTableRow = useCallback(
		async (itemsPath: string, columns: TableColumn[]) => {
			const items = getValue(itemsPath);
			const itemsArray = Array.isArray(items) ? items : [];

			const newRow: Record<string, InvoiceDataValue> = {};
			columns.forEach((col) => {
				newRow[col.binding] = col.type === "number" ? 0 : "";
			});

			await setValue(itemsPath, [...itemsArray, newRow]);
		},
		[setValue, getValue]
	);

	const removeTableRow = useCallback(
		async (itemsPath: string, index: number) => {
			const items = getValue(itemsPath);
			const itemsArray = Array.isArray(items) ? items : [];

			await setValue(
				itemsPath,
				itemsArray.filter((_: InvoiceDataValue, i: number) => i !== index)
			);
		},
		[setValue, getValue]
	);

	const handleCellChange = useCallback(
		(itemsPath: string, rowIndex: number, binding: string, value: InvoiceDataValue) => {
			updateTableCell(itemsPath, rowIndex, binding, value);
		},
		[updateTableCell]
	);

	const handleCellBlur = useCallback(
		(itemsPath: string, rowIndex: number, binding: string, value: InvoiceDataValue) => {
			updateTableCell(itemsPath, rowIndex, binding, value);
		},
		[updateTableCell]
	);

	return {
		addTableRow,
		removeTableRow,
		handleCellChange,
		handleCellBlur,
	};
}


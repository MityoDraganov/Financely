import { describe, expect, it } from "vitest";
import type { TemplateElement } from "@/core/entities/template";
import { computeTableRuntimeLayout } from "./template-table-layout";

function createTable(overrides?: Partial<Extract<TemplateElement, { type: "table" }>>): Extract<TemplateElement, { type: "table" }> {
	return {
		id: "table-1",
		type: "table",
		x: 0,
		y: 0,
		width: 180,
		height: 40,
		rotation: 0,
		zIndex: 1,
		visible: true,
		headerHeight: 20,
		rowHeight: 20,
		stripe: false,
		columns: [
			{
				id: "description",
				header: "Description",
				width: "1fr",
				align: "left",
				type: "text",
				binding: "description",
				format: { kind: "none" },
				showTotal: false,
			},
		],
		designRows: [],
		itemsBinding: "items",
		...overrides,
	};
}

describe("computeTableRuntimeLayout", () => {
	it("increases row height for wrapped multiline text", () => {
		const table = createTable({
			rowStyle: {
				fontSize: 12,
				textBehavior: { mode: "wrap" },
			},
		});
		const context = {
			items: [
				{
					description:
						"This is a very long line item description that should wrap to multiple lines in the preview table.",
				},
			],
		};

		const layout = computeTableRuntimeLayout(table, context);
		expect(layout.rowHeights).toHaveLength(1);
		expect(layout.rowHeights[0]).toBeGreaterThan(table.rowHeight);
		expect(layout.totalHeight).toBeGreaterThan(table.headerHeight + table.rowHeight);
	});

	it("creates taller rows with wrap than with nowrap for the same content", () => {
		const wrapTable = createTable({
			rowStyle: {
				fontSize: 12,
				textBehavior: { mode: "wrap" },
			},
		});
		const nowrapTable = createTable({
			rowStyle: {
				fontSize: 12,
				textBehavior: { mode: "nowrap" },
			},
		});
		const context = {
			items: [
				{
					description:
						"This is a very long line item description that would wrap if wrapping were enabled.",
				},
			],
		};

		const wrapLayout = computeTableRuntimeLayout(wrapTable, context);
		const nowrapLayout = computeTableRuntimeLayout(nowrapTable, context);
		expect(wrapLayout.rowHeights).toHaveLength(1);
		expect(nowrapLayout.rowHeights).toHaveLength(1);
		expect(wrapLayout.rowHeights[0]).toBeGreaterThan(nowrapLayout.rowHeights[0]);
	});
});

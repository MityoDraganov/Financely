import { describe, expect, it } from "vitest";
import type { Template, TemplateElement } from "@/core/entities/template";
import { paginateTemplate } from "./template-pagination";

const ZERO_SPACING = { top: 0, right: 0, bottom: 0, left: 0 };

function createTemplate(elements: TemplateElement[]): Template {
	return {
		id: "template-test",
		orgId: "org-test",
		name: "Template Test",
		pageSize: "A4",
		status: "draft",
		brand: {
			fonts: ["Inter"],
			colors: {
				primary: "#111827",
				secondary: "#6b7280",
				accent: "#2563eb",
			},
			margins: ZERO_SPACING,
		},
		pageSettings: {
			size: "A4",
			orientation: "portrait",
			margins: ZERO_SPACING,
			marginUnit: "in",
			padding: ZERO_SPACING,
		},
		elements,
	};
}

function createTableElement(overrides?: Partial<Extract<TemplateElement, { type: "table" }>>): Extract<TemplateElement, { type: "table" }> {
	return {
		id: "table-1",
		type: "table",
		x: 80,
		y: 120,
		width: 320,
		height: 40,
		rotation: 0,
		zIndex: 2,
		visible: true,
		rowHeight: 20,
		headerHeight: 20,
		stripe: false,
		columns: [
			{
				id: "col-1",
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

describe("paginateTemplate table background growth", () => {
	it("grows a box background that tightly frames a table behind it", () => {
		const background: Extract<TemplateElement, { type: "box" }> = {
			id: "bg-box",
			type: "box",
			x: 70,
			y: 110,
			width: 340,
			height: 50,
			rotation: 0,
			zIndex: 1,
			visible: true,
			fill: "#f3f4f6",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const table = createTableElement();
		const template = createTemplate([background, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedBackground = pages[0]?.elements.find((el) => el.id === background.id) as
			| Extract<TemplateElement, { type: "box" }>
			| undefined;

		expect(renderedBackground).toBeDefined();
		// Original table height = 20 + 20 = 40; actual = 20 + 5*20 = 120; growth = 80.
		expect(renderedBackground?.height).toBe(background.height + 80);
	});

	it("does not grow broad wrapper backgrounds that are not table-specific", () => {
		const broadWrapper: Extract<TemplateElement, { type: "box" }> = {
			id: "bg-wrapper",
			type: "box",
			x: 0,
			y: 0,
			width: 500,
			height: 700,
			rotation: 0,
			zIndex: 0,
			visible: true,
			fill: "#ffffff",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const table = createTableElement();
		const template = createTemplate([broadWrapper, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedWrapper = pages[0]?.elements.find((el) => el.id === broadWrapper.id) as
			| Extract<TemplateElement, { type: "box" }>
			| undefined;

		expect(renderedWrapper).toBeDefined();
		expect(renderedWrapper?.height).toBe(broadWrapper.height);
	});

	it("grows a path background that tightly frames a table", () => {
		const pathBackground: Extract<TemplateElement, { type: "path" }> = {
			id: "bg-path",
			type: "path",
			x: 70,
			y: 110,
			width: 340,
			height: 50,
			rotation: 0,
			zIndex: 1,
			visible: true,
			pathData: "M 0 0 L 340 0 L 340 50 L 0 50 Z",
			fill: "#f9fafb",
			stroke: "#00000000",
			strokeWidth: 0,
			opacity: 1,
			fillRule: "nonzero",
			scaleStroke: false,
		};
		const table = createTableElement();
		const template = createTemplate([pathBackground, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedPath = pages[0]?.elements.find((el) => el.id === pathBackground.id) as
			| Extract<TemplateElement, { type: "path" }>
			| undefined;

		expect(renderedPath).toBeDefined();
		expect(renderedPath?.height).toBe(pathBackground.height + 80);
	});

	it("grows a bottom-aligned background even when it is not tightly framed", () => {
		const wideBackground: Extract<TemplateElement, { type: "box" }> = {
			id: "bg-wide-bottom-aligned",
			type: "box",
			x: 0,
			y: 0,
			width: 420,
			height: 160, // table original bottom is also at y=160
			rotation: 0,
			zIndex: 1,
			visible: true,
			fill: "#f3f4f6",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const table = createTableElement();
		const template = createTemplate([wideBackground, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedBackground = pages[0]?.elements.find(
			(el) => el.id === wideBackground.id
		) as Extract<TemplateElement, { type: "box" }> | undefined;

		expect(renderedBackground).toBeDefined();
		expect(renderedBackground?.height).toBe(wideBackground.height + 80);
	});

	it("grows a tall background that covers table top and extends far below", () => {
		const tallBackground: Extract<TemplateElement, { type: "box" }> = {
			id: "bg-tall-cover",
			type: "box",
			x: 70,
			y: 110,
			width: 340,
			height: 260, // much taller than the original table bounds
			rotation: 0,
			zIndex: 1,
			visible: true,
			fill: "#f3f4f6",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const table = createTableElement();
		const template = createTemplate([tallBackground, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedBackground = pages[0]?.elements.find(
			(el) => el.id === tallBackground.id
		) as Extract<TemplateElement, { type: "box" }> | undefined;

		expect(renderedBackground).toBeDefined();
		expect(renderedBackground?.height).toBe(tallBackground.height + 80);
	});

	it("grows a bottom-aligned background when z-index is equal to the table", () => {
		const equalZBackground: Extract<TemplateElement, { type: "box" }> = {
			id: "bg-equal-z",
			type: "box",
			x: 40,
			y: 120,
			width: 320,
			height: 40, // aligns to table original bottom (120 + 40)
			rotation: 0,
			zIndex: 2,
			visible: true,
			fill: "#f3f4f6",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const table = createTableElement({ zIndex: 2 });
		const template = createTemplate([equalZBackground, table]);
		const context = {
			items: [
				{ description: "A" },
				{ description: "B" },
				{ description: "C" },
				{ description: "D" },
				{ description: "E" },
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const renderedBackground = pages[0]?.elements.find(
			(el) => el.id === equalZBackground.id
		) as Extract<TemplateElement, { type: "box" }> | undefined;

		expect(renderedBackground).toBeDefined();
		expect(renderedBackground?.height).toBe(equalZBackground.height + 80);
	});

	it("moves elements below a table when wrapped row content increases runtime row height", () => {
		const table = createTableElement({
			width: 180,
			columns: [
				{
					id: "col-1",
					header: "Description",
					width: "1fr",
					align: "left",
					type: "text",
					binding: "description",
					format: { kind: "none" },
					showTotal: false,
				},
			],
			rowStyle: {
				fontSize: 12,
				textBehavior: { mode: "wrap" },
			},
		});
		const belowBox: Extract<TemplateElement, { type: "box" }> = {
			id: "below-box",
			type: "box",
			x: 80,
			y: 980,
			width: 200,
			height: 30,
			rotation: 0,
			zIndex: 3,
			visible: true,
			fill: "#111827",
			stroke: "#00000000",
			strokeWidth: 0,
			radius: 0,
			opacity: 1,
		};
		const template = createTemplate([table, belowBox]);
		const context = {
			items: [
				{
					description:
						"This line is intentionally long so it wraps into multiple lines and increases the row height.",
				},
			],
		};

		const pages = paginateTemplate(template, context, { w: 600, h: 1000 });
		const pageIndexWithBelowBox = pages.findIndex((page) =>
			page.elements.some((element) => element.id === belowBox.id)
		);

		expect(pageIndexWithBelowBox).toBe(1);
	});
});

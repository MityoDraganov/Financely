/**
 * Template Preview Component
 * Renders a template with invoice data, handling pagination and element rendering
 */

import React from "react";
import type { Template } from "@/core/entities/template";
import { paginateTemplate, type RenderPage } from "@/utils/template-pagination";
import { PAGE_SIZES } from "@/utils/template-preview-utils";
import { renderTemplateElement } from "./template-element-renderers";
import { renderWatermark } from "./template-watermark";
import { resolveTemplateMarginsPx } from "@/utils/print-margins";

type InvoicePreviewContext = unknown;

interface TemplatePreviewProps {
	readonly template: Template;
	readonly context: InvoicePreviewContext;
	readonly zoom?: number;
}

export function TemplatePreview({
	template,
	context,
	zoom = 0.75,
}: TemplatePreviewProps) {
	const baseSize =
		template.pageSettings?.size === "Custom" && template.pageSettings.customSize
			? {
					w: template.pageSettings.customSize.width,
					h: template.pageSettings.customSize.height,
				}
			: PAGE_SIZES[(template.pageSettings?.size ?? template.pageSize) as keyof typeof PAGE_SIZES] ?? PAGE_SIZES.A4;
	const size = template.pageSettings?.orientation === "landscape"
		? { w: baseSize.h, h: baseSize.w }
		: baseSize;

	// Paginate template into multiple pages
	const pages = React.useMemo(
		() => paginateTemplate(template, context, size),
		[template, context, size]
	);

	// Calculate visual dimensions after scaling
	const scaledWidth = size.w * zoom;
	const scaledHeight = size.h * zoom;

	// Render watermark if enabled
	const watermarkElement = template.brand.watermark
		? renderWatermark({ watermark: template.brand.watermark })
		: null;

	// Get margins from template
		const margins = resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins);
	
	// Render a single page
	const renderPage = (page: RenderPage) => {
		const renderContext = {
			context,
			page,
			pageIndex: page.pageIndex,
			pageSize: size,
			templateElements: template.elements ?? [],
			margins,
		};

		return (
			<div
				key={page.pageIndex}
				style={{
					width: scaledWidth,
					height: scaledHeight,
					maxWidth: "100%",
					maxHeight: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
					marginBottom: page.pageIndex < pages.length - 1 ? "20px" : 0,
				}}
			>
				{/* Canvas at original size, scaled visually via transform */}
				<div
					className="bg-white dark:bg-neutral-900 shadow relative border border-border"
					style={{
						width: size.w,
						height: size.h,
						backgroundColor: template.pageSettings?.backgroundColor || undefined,
						transform: `scale(${zoom})`,
						transformOrigin: "top left",
						overflow: "hidden",
						willChange: "transform",
						backfaceVisibility: "hidden",
					}}
				>
					{watermarkElement}
					{page.elements.map((el) =>
						renderTemplateElement(el, renderContext)
					)}
				</div>
			</div>
		);
	};

	return (
		<div
			className="flex flex-col items-center w-full h-full"
			style={{
				minWidth: 0,
				minHeight: 0,
				overflow: "auto",
				position: "relative",
				padding: "20px",
			}}
		>
			{pages.map(renderPage)}
		</div>
	);
}

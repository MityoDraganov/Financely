/**
 * Template Preview Component
 * Renders a template with invoice data, handling pagination and element rendering
 */

import React from "react";
import type { Template } from "@/core/entities/template";
import { paginateTemplate, type RenderPage } from "@/utils/template-pagination";
import { PAGE_SIZES, sortTemplateElementsForPaintOrder } from "@/utils/template-preview-utils";
import { renderTemplateElement } from "./template-element-renderers";
import { renderWatermark } from "./template-watermark";
import { resolveTemplateMarginsPx } from "@/utils/print-margins";

type InvoicePreviewContext = unknown;

interface TemplatePreviewProps {
	readonly template: Template;
	readonly context: InvoicePreviewContext;
	readonly zoom?: number;
	readonly onFieldClick?: (binding: string) => void;
}

export function TemplatePreview({
	template,
	context,
	zoom = 0.75,
	onFieldClick,
}: TemplatePreviewProps) {
	const [fontMetricsVersion, setFontMetricsVersion] = React.useState(0);
	const size = React.useMemo(() => {
		const baseSize =
			template.pageSettings?.size === "Custom" && template.pageSettings.customSize
				? {
						w: template.pageSettings.customSize.width,
						h: template.pageSettings.customSize.height,
					}
				: PAGE_SIZES[(template.pageSettings?.size ?? template.pageSize) as keyof typeof PAGE_SIZES] ?? PAGE_SIZES.A4;
		return template.pageSettings?.orientation === "landscape"
			? { w: baseSize.h, h: baseSize.w }
			: baseSize;
	}, [template.pageSettings, template.pageSize]);

	// Recompute pagination/layout when web font metrics settle.
	React.useEffect(() => {
		if (typeof document === "undefined" || !("fonts" in document)) return;
		const fontSet = (document as Document & { fonts: FontFaceSet }).fonts;
		let cancelled = false;

		const bumpVersion = () => {
			if (cancelled) return;
			setFontMetricsVersion((value) => value + 1);
		};

		fontSet.ready.then(bumpVersion).catch(() => {
			// Ignore font readiness errors.
		});

		fontSet.addEventListener("loadingdone", bumpVersion);
		fontSet.addEventListener("loadingerror", bumpVersion);

		return () => {
			cancelled = true;
			fontSet.removeEventListener("loadingdone", bumpVersion);
			fontSet.removeEventListener("loadingerror", bumpVersion);
		};
	}, [template.id]);

	// Paginate template into multiple pages
	const pages = React.useMemo(() => {
		// Ensure pagination recomputes after font metrics updates.
		void fontMetricsVersion;
		return paginateTemplate(template, context, size);
	}, [template, context, size, fontMetricsVersion]);

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
			onFieldClick,
		};

		return (
			<div
				key={page.pageIndex}
				style={{
					width: scaledWidth,
					height: scaledHeight,
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
					<div
						style={{
							position: "absolute",
							inset: 0,
							zIndex: 0,
							isolation: "isolate",
							pointerEvents: "none",
						}}
					>
						{watermarkElement}
						{sortTemplateElementsForPaintOrder(page.backgroundElements).map((el) =>
							renderTemplateElement(el, { ...renderContext, isBackground: true })
						)}
					</div>
					<div
						style={{
							position: "absolute",
							inset: 0,
							zIndex: 100,
							isolation: "isolate",
						}}
					>
						{sortTemplateElementsForPaintOrder(page.elements).map((el) =>
							renderTemplateElement(el, renderContext)
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div
			className="flex flex-col items-center w-full"
			style={{
				minWidth: 0,
				minHeight: 0,
				overflow: "visible",
				position: "relative",
				padding: "20px",
			}}
		>
			{pages.map(renderPage)}
		</div>
	);
}

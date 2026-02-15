import { FileText } from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { Template } from "@/core";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { useRef, useEffect, useState } from "react";
import { PAGE_SIZES_PX } from "@/utils/page-size-presets";

interface InvoicePreviewProps {
	template: Template | undefined;
	formData: Record<string, InvoiceDataValue>;
	fullWidth?: boolean;
}

export function InvoicePreview({
	template,
	formData,
	fullWidth = false,
}: InvoicePreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState(0.8);

	// Calculate zoom based on available width
	useEffect(() => {
		if (!template || !containerRef.current) return;

		const baseSize =
			template.pageSettings?.size === "Custom" && template.pageSettings.customSize
				? { w: template.pageSettings.customSize.width, h: template.pageSettings.customSize.height }
				: PAGE_SIZES_PX[(template.pageSettings?.size ?? template.pageSize) as Template["pageSize"]] ?? PAGE_SIZES_PX.A4;
		const size = template.pageSettings?.orientation === "landscape"
			? { w: baseSize.h, h: baseSize.w }
			: baseSize;

		const updateZoom = () => {
			if (!containerRef.current) return;
			const containerWidth = containerRef.current.clientWidth;
			// Use full width if fullWidth prop is true, otherwise leave padding
			const availableWidth = fullWidth ? containerWidth : containerWidth - 32;
			const calculatedZoom = availableWidth / size.w;
			// Clamp zoom between 0.3 and 1.5 for reasonable scaling
			setZoom(Math.max(0.3, Math.min(1.5, calculatedZoom)));
		};

		updateZoom();
		const resizeObserver = new ResizeObserver(updateZoom);
		resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
		};
	}, [template, fullWidth]);

	if (!template) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<FileText className="h-12 w-12 text-muted-foreground mb-4" />
				<h3 className="text-lg font-semibold mb-2">
					Select a Template
				</h3>
				<p className="text-muted-foreground">
					Choose a template from the sidebar to preview your
					invoice
				</p>
			</div>
		);
	}

	return (
		<div className="w-full space-y-2">
			<div
				ref={containerRef}
				className="w-full flex justify-center"
			>
				<TemplatePreview
					template={template}
					context={formData}
					zoom={zoom}
				/>
			</div>
		</div>
	);
}

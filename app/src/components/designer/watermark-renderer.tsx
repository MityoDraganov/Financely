import { Template } from "@/core";

type WatermarkRendererProps = {
	template: Template | undefined;
	zoom: number;
};

export function WatermarkRenderer({ template, zoom }: WatermarkRendererProps) {
	const watermarkEnabled = template?.brand?.watermark?.enabled;
	const watermark = template?.brand?.watermark;

	if (!watermarkEnabled || !watermark) {
		return null;
	}

	const watermarkImageUrl = watermark.imageUrl;
	const watermarkText = watermark.text;

	if (!watermarkImageUrl && !watermarkText) {
		return null;
	}

	// Calculate position
	let positionStyle: React.CSSProperties = {};
	if (watermark.x !== undefined && watermark.y !== undefined) {
		positionStyle = {
			left: watermark.x * zoom,
			top: watermark.y * zoom,
			transform: `translate(0, 0) rotate(${watermark.rotation || 0}deg)`,
		};
	} else {
		const positions: Record<string, React.CSSProperties> = {
			"center": {
				left: "50%",
				top: "50%",
				transform: `translate(-50%, -50%) rotate(${watermark.rotation || 0}deg)`,
			},
			"top-left": { left: 0, top: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
			"top-right": { right: 0, top: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
			"bottom-left": { left: 0, bottom: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
			"bottom-right": { right: 0, bottom: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
			"top-center": { left: "50%", top: 0, transform: `translateX(-50%) rotate(${watermark.rotation || 0}deg)` },
			"bottom-center": { left: "50%", bottom: 0, transform: `translateX(-50%) rotate(${watermark.rotation || 0}deg)` },
			"left-center": { left: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation || 0}deg)` },
			"right-center": { right: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation || 0}deg)` },
		};
		positionStyle = positions[watermark.position || "center"] || positions.center;
	}

	const width = (watermark.width || 200) * zoom;
	const height = watermark.height ? watermark.height * zoom : undefined;
	const opacity = watermark.opacity ?? 0.1;
	const blendMode = watermark.blendMode || "normal";

	if (watermarkImageUrl) {
		return (
			<div
				key="watermark-image"
				style={{
					position: "absolute",
					...positionStyle,
					width,
					height: height || width,
					opacity,
					mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
					pointerEvents: "none",
					zIndex: 1000,
				}}
			>
				<img
					src={watermarkImageUrl}
					alt="Watermark"
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			</div>
		);
	}

	if (watermarkText) {
		return (
			<div
				key="watermark-text"
				style={{
					position: "absolute",
					...positionStyle,
					width,
					minWidth: width,
					opacity,
					mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
					pointerEvents: "none",
					zIndex: 1000,
					fontSize: Math.max(24, width / 10) * zoom,
					fontWeight: "bold",
					color: "#999999",
					textAlign: "center",
					whiteSpace: "nowrap",
				}}
			>
				{watermarkText}
			</div>
		);
	}

	return null;
}


import { Fragment } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Clock, Lock, Shield, Star } from "lucide-react";
import type {
	WidgetPageFooterLink,
	WidgetPageSchema,
	WidgetPageSchemaBlock,
	WidgetPageSchemaWidgetFormBlock,
	WidgetPageTrustSignal,
} from "@/core/entities/widget-definition";
import { cn } from "@/lib/utils";

function contrastColor(hex: string): string {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const rgb = result
		? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16),
		}
		: { r: 37, g: 99, b: 235 };
	const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
	return luminance > 0.55 ? "#111827" : "#ffffff";
}

function sanitizeFooterLinks(links: WidgetPageFooterLink[] | undefined): WidgetPageFooterLink[] {
	return (links ?? [])
		.map((link) => ({
			label: String(link?.label ?? "").trim(),
			url: String(link?.url ?? "").trim(),
		}))
		.filter((link) => link.label.length > 0 || link.url.length > 0);
}

type RenderFormBlockArgs = {
	block: WidgetPageSchemaWidgetFormBlock;
	zone: "sidebar" | "main";
	sidebarOnPrimary: string;
};

interface WidgetSchemaLayoutProps {
	branding: {
		logo: string | null;
		companyName: string;
	};
	schema: WidgetPageSchema;
	primary: string;
	rgb: { r: number; g: number; b: number };
	renderFormBlock: (args: RenderFormBlockArgs) => ReactNode;
	selectedBlockId?: string | null;
	onSelectBlock?: (blockId: string) => void;
	showPoweredByLink?: boolean;
	rootClassName?: string;
}

export function WidgetSchemaLayout({
	branding,
	schema,
	primary,
	rgb,
	renderFormBlock,
	selectedBlockId,
	onSelectBlock,
	showPoweredByLink = true,
	rootClassName = "min-h-screen w-screen max-w-none",
}: WidgetSchemaLayoutProps) {
	const sidebarPrimary = schema.layout.sidebarPrimaryColor?.trim() || primary;
	const sidebarOnPrimary = contrastColor(sidebarPrimary);
	const sidebarPosition = schema.layout.sidebarPosition;
	const backgroundStyle = schema.layout.backgroundStyle ?? "clean";
	const sidebarWidth = schema.layout.sidebarWidth === "sm"
		? 320
		: schema.layout.sidebarWidth === "lg"
			? 440
			: 380;

	const pageBackground = backgroundStyle === "subtle-grid"
		? `#f8f7f5 url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 .5H31.5V32' fill='none' stroke='%23${primary.replace("#", "")}' stroke-opacity='0.06' stroke-width='0.5'/%3E%3C/svg%3E")`
		: backgroundStyle === "gradient"
			? `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.04) 0%, #f8f7f5 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.02) 100%)`
			: "#f8f7f5";

	const sidebarOrderClass = sidebarPosition === "left"
		? "order-1 lg:order-1"
		: "order-1 lg:order-2";
	const mainOrderClass = sidebarPosition === "left"
		? "order-2 lg:order-2"
		: "order-2 lg:order-1";

	const interactive = typeof onSelectBlock === "function";

	const renderTrustIcon = (icon: WidgetPageTrustSignal["icon"]) => {
		if (icon === "shield") return <Shield size={13} strokeWidth={2} />;
		if (icon === "clock") return <Clock size={13} strokeWidth={2} />;
		if (icon === "star") return <Star size={13} strokeWidth={2} />;
		if (icon === "check") return <Check size={13} strokeWidth={2} />;
		return <Lock size={13} strokeWidth={2} />;
	};

	const handleSelectKeyDown = (event: KeyboardEvent<HTMLDivElement>, blockId: string) => {
		if (!onSelectBlock) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onSelectBlock(blockId);
		}
	};

	const wrapSelectable = (blockId: string, content: ReactNode) => {
		if (!interactive) return <Fragment key={blockId}>{content}</Fragment>;
		const isSelected = selectedBlockId === blockId;
		return (
			<div
				key={blockId}
				role="button"
				tabIndex={0}
				onClick={() => onSelectBlock?.(blockId)}
				onKeyDown={(event) => handleSelectKeyDown(event, blockId)}
				className={cn(
					"rounded-lg border border-transparent text-left transition-all",
					isSelected
						? "ring-2 ring-primary/45 border-primary/60"
						: "hover:ring-1 hover:ring-primary/20",
				)}
			>
				{content}
			</div>
		);
	};

	const renderBlocks = (
		blocks: WidgetPageSchemaBlock[],
		zone: "sidebar" | "main",
		depth = 0,
	): ReactNode => {
		return blocks.map((block) => {
			if (block.type === "stack") {
				const stackGap = block.gap === "sm" ? "space-y-2" : block.gap === "lg" ? "space-y-5" : "space-y-3";
				return wrapSelectable(
					block.id,
					<div
						className={cn(
							"rounded-lg",
							zone === "sidebar" ? "bg-white/10 p-4" : "border border-border/70 bg-card p-4",
						)}
						style={depth > 0 ? { marginLeft: 8 } : undefined}
					>
						<div className={stackGap}>
							{renderBlocks(block.children, zone, depth + 1)}
						</div>
					</div>,
				);
			}

			if (block.type === "logo") {
				return wrapSelectable(
					block.id,
					<div className="flex items-center justify-start">
						{branding.logo ? (
							<img
								src={branding.logo}
								alt={branding.companyName}
								className="h-9 max-w-[160px] object-contain"
							/>
						) : (
							<span className={zone === "sidebar" ? "text-sm font-semibold" : "text-sm font-semibold text-foreground"}>
								{branding.companyName}
							</span>
						)}
						{block.showCompanyName && branding.logo && (
							<span className={cn("ml-2 text-sm font-medium", zone === "sidebar" ? "opacity-80" : "text-muted-foreground")}>
								{branding.companyName}
							</span>
						)}
					</div>,
				);
			}

			if (block.type === "heading") {
				const HeadingTag: "h1" | "h2" | "h3" =
					block.level === 1 ? "h1" : block.level === 3 ? "h3" : "h2";
				return wrapSelectable(
					block.id,
					<HeadingTag
						className={cn(
							"tracking-tight",
							zone === "sidebar"
								? block.level === 1
									? "text-3xl font-medium leading-tight"
									: "text-xl font-semibold"
								: block.level === 1
									? "text-3xl font-semibold text-foreground"
									: "text-xl font-semibold text-foreground",
						)}
					>
						{block.text}
					</HeadingTag>,
				);
			}

			if (block.type === "text") {
				return wrapSelectable(
					block.id,
					<p
						className={cn(
							"whitespace-pre-wrap text-sm leading-6",
							zone === "sidebar" ? "opacity-85" : "text-muted-foreground",
						)}
					>
						{block.text}
					</p>,
				);
			}

			if (block.type === "list") {
				return wrapSelectable(
					block.id,
					<ul className={cn("list-disc pl-5 space-y-1 text-sm", zone === "sidebar" ? "opacity-85" : "text-muted-foreground")}>
						{block.items.map((item, index) => (
							<li key={`${block.id}-list-${index}`}>{item}</li>
						))}
					</ul>,
				);
			}

			if (block.type === "iconList") {
				return wrapSelectable(
					block.id,
					<ul className="space-y-2">
						{block.items.map((item, index) => (
							<li key={`${block.id}-icon-${index}`} className="flex items-center gap-2.5 text-sm">
								<span className={cn(
									"inline-flex h-6 w-6 items-center justify-center rounded-md",
									zone === "sidebar" ? "bg-white/15" : "bg-muted",
								)}>
									{renderTrustIcon(item.icon)}
								</span>
								<span className={zone === "sidebar" ? "opacity-90" : "text-muted-foreground"}>
									{item.text}
								</span>
							</li>
						))}
					</ul>,
				);
			}

			if (block.type === "policyLinks") {
				return wrapSelectable(
					block.id,
					<nav className="flex flex-wrap gap-3">
						{sanitizeFooterLinks(block.links).map((link, index) => (
							interactive ? (
								<span
									key={`${block.id}-policy-${index}`}
									className={cn(
										"text-xs underline underline-offset-2",
										zone === "sidebar" ? "opacity-80" : "text-muted-foreground",
									)}
								>
									{link.label}
								</span>
							) : (
								<a
									key={`${block.id}-policy-${index}`}
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									className={cn(
										"text-xs underline underline-offset-2",
										zone === "sidebar" ? "opacity-80" : "text-muted-foreground",
									)}
								>
									{link.label}
								</a>
							)
						))}
					</nav>,
				);
			}

			if (block.type === "spacer") {
				const spacerClass = block.size === "sm" ? "h-3" : block.size === "lg" ? "h-10" : "h-6";
				return wrapSelectable(block.id, <div className={spacerClass} aria-hidden />);
			}

			return wrapSelectable(
				block.id,
				renderFormBlock({ block, zone, sidebarOnPrimary }),
			);
		});
	};

	return (
		<div
			className={cn("font-sans", rootClassName)}
			style={{ background: pageBackground, fontFamily: "system-ui, sans-serif" }}
		>
			<div
				className="min-h-full flex flex-col lg:grid"
				style={{
					gridTemplateColumns:
						sidebarPosition === "left"
							? `${sidebarWidth}px minmax(0, 1fr)`
							: `minmax(0, 1fr) ${sidebarWidth}px`,
				}}
			>
				<aside
					className={cn("px-8 py-10 flex flex-col gap-5", sidebarOrderClass)}
					style={{ background: sidebarPrimary, color: sidebarOnPrimary }}
				>
					{renderBlocks(schema.sidebar, "sidebar")}
					{showPoweredByLink && (
						<div className="mt-auto pt-8">
							<Link to="/" className="text-xs opacity-70 hover:opacity-100">
								Powered by Financely
							</Link>
						</div>
					)}
				</aside>

				<main className={cn("px-5 sm:px-8 py-10", mainOrderClass)}>
					<div className="mx-auto w-full max-w-[560px] space-y-4">
						{renderBlocks(schema.main, "main")}
					</div>
				</main>
			</div>
		</div>
	);
}

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Shield, Clock, Star, Check, Lock, ArrowRight } from "lucide-react";
import { LoadingScreen } from "@/components/loading-screen";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type { WidgetVersionActions } from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";
import { projectId } from "@/infrastructure/firebase";
import { functionsService } from "@/services/functions/functions-service";
import type { WidgetMultiStepOptions } from "@/core/entities/widget-version";
import { WidgetPage } from "@/core/entities/widget-block-schema";
import { cn } from "@/lib/utils";
import type {
	WidgetPageBlock,
	WidgetPageConfig,
	WidgetPageCopyBlock,
	WidgetPageFooterLink,
	WidgetPageLayout,
	WidgetPageSchema,
	WidgetPageSchemaBlock,
	WidgetPagePolicyLinksBlock,
	WidgetPageSidePanelBlock,
	WidgetPageSchemaWidgetFormBlock,
	WidgetPageTrustSignal,
} from "@/core/entities/widget-definition";

// ─── Utilities ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
		  }
		: { r: 37, g: 99, b: 235 };
}

function contrastColor(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.55 ? "#111827" : "#ffffff";
}

const DEFAULT_TRUST_SIGNALS: WidgetPageTrustSignal[] = [
	{ icon: "shield", label: "Your data is secure" },
	{ icon: "clock", label: "Replies within 24h" },
	{ icon: "star", label: "No spam, ever" },
];

function sanitizeFooterLinks(links: WidgetPageFooterLink[] | undefined): WidgetPageFooterLink[] {
	return (links ?? [])
		.map((link) => ({
			label: String(link?.label ?? "").trim(),
			url: String(link?.url ?? "").trim(),
		}))
		.filter((link) => link.label.length > 0 || link.url.length > 0);
}

function sanitizeTrustSignals(
	trustSignals: WidgetPageTrustSignal[] | undefined,
): WidgetPageTrustSignal[] {
	return (trustSignals ?? [])
		.map((signal) => ({
			icon: signal.icon,
			label: String(signal.label ?? "").trim(),
		}))
		.filter((signal) => signal.label.length > 0);
}

function getLayoutBlocks(config: WidgetPageConfig | null): WidgetPageBlock[] {
	if (!config) {
		return [
			{
				id: "default-side-panel",
				type: "sidePanel",
				position: "left",
				trustSignals: [...DEFAULT_TRUST_SIGNALS],
			},
		];
	}

	if (Array.isArray(config.blocks) && config.blocks.length > 0) {
		return config.blocks;
	}

	const blocks: WidgetPageBlock[] = [];
	if (config.hideBrandPanel !== true) {
		blocks.push({
			id: "legacy-side-panel",
			type: "sidePanel",
			position: "left",
			title: config.headline,
			body: config.body,
			primaryColor: config.primaryColor,
			trustSignals: sanitizeTrustSignals(config.trustSignals),
		});
	}

	const legacyLinks = sanitizeFooterLinks(config.footerLinks);
	if (legacyLinks.length > 0) {
		blocks.push({
			id: "legacy-policy-links",
			type: "policyLinks",
			position: "bottom",
			links: legacyLinks,
		});
	}

	return blocks;
}

function hasSchemaBlockType(
	blocks: WidgetPageSchemaBlock[],
	type: WidgetPageSchemaBlock["type"],
): boolean {
	for (const block of blocks) {
		if (block.type === type) return true;
		if (block.type === "stack" && hasSchemaBlockType(block.children, type)) return true;
	}
	return false;
}

function migrateToSchema(config: WidgetPageConfig | null, widgetName: string): WidgetPageSchema {
	if (config?.schema?.version === 1) {
		const withForm = hasSchemaBlockType(config.schema.main, "widgetForm")
			? config.schema.main
			: [
				...config.schema.main,
				{
					id: "schema-default-widget-form",
					type: "widgetForm",
					title: config.formTitle ?? "Get in touch",
					subtitle:
						config.formSubtitle ??
						"Fill in the details below and we'll get back to you.",
				} satisfies WidgetPageSchemaWidgetFormBlock,
			];
		return { ...config.schema, main: withForm };
	}

	const legacyBlocks = getLayoutBlocks(config);
	const sidePanel = legacyBlocks.find(
		(block): block is WidgetPageSidePanelBlock => block.type === "sidePanel",
	);
	const topLegacyBlocks = legacyBlocks.filter(
		(block): block is WidgetPageCopyBlock | WidgetPagePolicyLinksBlock =>
			block.type !== "sidePanel" && block.position === "top",
	);
	const bottomLegacyBlocks = legacyBlocks.filter(
		(block): block is WidgetPageCopyBlock | WidgetPagePolicyLinksBlock =>
			block.type !== "sidePanel" && block.position === "bottom",
	);

	const sidebarSignals = sanitizeTrustSignals(sidePanel?.trustSignals ?? config?.trustSignals);
	const sidebarBlocks: WidgetPageSchemaBlock[] = [
		{
			id: "schema-sidebar-logo",
			type: "logo",
			showCompanyName: false,
		},
		{
			id: "schema-sidebar-heading",
			type: "heading",
			text: sidePanel?.title?.trim() || config?.headline?.trim() || widgetName,
			level: 1,
		},
		{
			id: "schema-sidebar-body",
			type: "text",
			text:
				sidePanel?.body?.trim() ||
				config?.body?.trim() ||
				"Complete the form and our team will review your submission.",
		},
		{
			id: "schema-sidebar-icons",
			type: "iconList",
			items: (sidebarSignals.length > 0 ? sidebarSignals : DEFAULT_TRUST_SIGNALS).map((signal) => ({
				icon: signal.icon,
				text: signal.label,
			})),
		},
	];

	const mapLegacyToSchemaBlocks = (
		block: WidgetPageCopyBlock | WidgetPagePolicyLinksBlock,
		prefix: string,
	): WidgetPageSchemaBlock[] => {
		if (block.type === "copy") {
			const mapped: WidgetPageSchemaBlock[] = [];
			if (block.title?.trim()) {
				mapped.push({
					id: `${prefix}-heading-${block.id}`,
					type: "heading",
					text: block.title.trim(),
					level: 2,
				});
			}
			if (block.body?.trim()) {
				mapped.push({
					id: `${prefix}-text-${block.id}`,
					type: "text",
					text: block.body.trim(),
				});
			}
			return mapped;
		}
		const links = sanitizeFooterLinks(block.links);
		if (links.length === 0) return [];
		return [
			{
				id: `${prefix}-policy-${block.id}`,
				type: "policyLinks",
				links,
			},
		];
	};

	const mainBlocks: WidgetPageSchemaBlock[] = [];
	topLegacyBlocks.forEach((block) => {
		mainBlocks.push(...mapLegacyToSchemaBlocks(block, "schema-top"));
	});
	mainBlocks.push({
		id: "schema-widget-form",
		type: "widgetForm",
		title: config?.formTitle?.trim() || "Get in touch",
		subtitle:
			config?.formSubtitle?.trim() ||
			"Fill in the details below and we'll get back to you.",
	});
	bottomLegacyBlocks.forEach((block) => {
		mainBlocks.push(...mapLegacyToSchemaBlocks(block, "schema-bottom"));
	});

	if (!hasSchemaBlockType(mainBlocks, "policyLinks")) {
		const fallbackLinks = sanitizeFooterLinks(config?.footerLinks);
		if (fallbackLinks.length > 0) {
			mainBlocks.push({
				id: "schema-fallback-policy-links",
				type: "policyLinks",
				links: fallbackLinks,
			});
		}
	}

	return {
		version: 1,
		layout: {
			mode: "sidebar",
			sidebarPosition: sidePanel?.position ?? "left",
			sidebarWidth: "md",
			backgroundStyle: config?.backgroundStyle ?? "clean",
			sidebarPrimaryColor: sidePanel?.primaryColor ?? config?.primaryColor,
		},
		sidebar: sidebarBlocks,
		main: mainBlocks,
	};
}

// ─── Types ───────────────────────────────────────────────────────────────────

type BrandingData = {
	logo: string | null;
	companyName: string;
	colors: Record<string, string>;
};

// ─── Default styling for widget internals ────────────────────────────────────

const defaultStyling: Partial<WidgetStyling> = {
	primaryColor: "#166534",
	backgroundColor: "#ffffff",
	textColor: "#111827",
	borderColor: "#d1d5db",
	successColor: "#166534",
	errorColor: "#ef4444",
	fontFamily: "system-ui, sans-serif",
	fontSize: "14px",
	borderRadius: "8px",
	buttonPadding: "12px 24px",
	buttonBorderRadius: "8px",
	shadow: "0 4px 12px rgba(0,0,0,0.15)",
};

// ─── Not Published Page ───────────────────────────────────────────────────────

function NotPublishedPage({
	branding,
	draftConfig,
}: {
	branding: BrandingData | null;
	draftConfig?: WidgetPageConfig["draftState"];
}) {
	const primary = branding?.colors?.primary ?? "#111827";
	const companyName = branding?.companyName ?? "This widget";
	const logo = branding?.logo;
	const rgb = hexToRgb(primary);
	const onPrimary = contrastColor(primary);

	const headline = draftConfig?.headline ?? null;
	const body = draftConfig?.body ?? null;
	const ctaLabel = draftConfig?.ctaLabel ?? null;
	const ctaUrl = draftConfig?.ctaUrl ?? null;

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

				@keyframes np-fadeUp {
					from { opacity: 0; transform: translateY(18px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				@keyframes np-scaleIn {
					from { opacity: 0; transform: scale(0.94); }
					to   { opacity: 1; transform: scale(1); }
				}
				@keyframes np-lineDraw {
					from { transform: scaleX(0); }
					to   { transform: scaleX(1); }
				}
				@keyframes np-shimmer {
					0%   { background-position: -200% center; }
					100% { background-position: 200% center; }
				}
				@keyframes np-orbFloat {
					0%, 100% { transform: translateY(0px) translateX(0px); }
					33%       { transform: translateY(-14px) translateX(6px); }
					66%       { transform: translateY(8px) translateX(-10px); }
				}
				@keyframes np-pulseDot {
					0%, 100% { opacity: 0.5; transform: scale(1); }
					50%       { opacity: 1; transform: scale(1.3); }
				}

				.np-root {
					min-height: 100vh;
					width: 100vw;
					max-width: none;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					background-color: #fafaf9;
					background-image:
						radial-gradient(circle at 20% 20%, rgba(${rgb.r},${rgb.g},${rgb.b},0.07) 0%, transparent 55%),
						radial-gradient(circle at 80% 80%, rgba(${rgb.r},${rgb.g},${rgb.b},0.05) 0%, transparent 50%),
						url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Ccircle fill='%23${primary.replace('#','')}' cx='1' cy='1' r='1' opacity='0.06'/%3E%3C/g%3E%3C/svg%3E");
					background-size: auto, auto, 40px 40px;
					font-family: 'DM Sans', system-ui, sans-serif;
					padding: 40px 24px;
					position: relative;
					overflow: hidden;
				}

				.np-root::before {
					content: '';
					position: absolute;
					top: -180px; right: -180px;
					width: 520px; height: 520px;
					border-radius: 50%;
					background: radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},0.12) 0%, transparent 70%);
					animation: np-orbFloat 12s ease-in-out infinite;
					pointer-events: none;
				}

				.np-root::after {
					content: '';
					position: absolute;
					bottom: -120px; left: -120px;
					width: 380px; height: 380px;
					border-radius: 50%;
					background: radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},0.08) 0%, transparent 70%);
					animation: np-orbFloat 16s ease-in-out infinite reverse;
					pointer-events: none;
				}

				.np-card {
					position: relative;
					z-index: 1;
					width: 100%;
					max-width: 520px;
					background: rgba(255,255,255,0.88);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					border: 1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.14);
					border-radius: 20px;
					padding: 52px 48px 44px;
					box-shadow:
						0 0 0 1px rgba(255,255,255,0.6) inset,
						0 8px 40px rgba(${rgb.r},${rgb.g},${rgb.b},0.10),
						0 2px 8px rgba(0,0,0,0.04);
					animation: np-scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
					text-align: center;
				}

				.np-logo-wrap {
					display: flex;
					justify-content: center;
					margin-bottom: 28px;
					animation: np-fadeUp 0.5s 0.05s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-logo-img {
					height: 48px;
					max-width: 160px;
					object-fit: contain;
				}

				.np-logo-placeholder {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 56px; height: 56px;
					border-radius: 14px;
					background: linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.15), rgba(${rgb.r},${rgb.g},${rgb.b},0.06));
					border: 1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.2);
					font-size: 22px;
					font-weight: 700;
					color: ${primary};
					font-family: 'DM Serif Display', Georgia, serif;
					letter-spacing: -0.5px;
				}

				.np-divider {
					width: 48px; height: 2px;
					background: ${primary};
					border-radius: 2px;
					margin: 0 auto 28px;
					transform-origin: left;
					animation: np-lineDraw 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-eyebrow {
					font-size: 10px;
					font-weight: 500;
					letter-spacing: 0.18em;
					text-transform: uppercase;
					color: ${primary};
					opacity: 0.7;
					margin-bottom: 12px;
					animation: np-fadeUp 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-headline {
					font-family: 'DM Serif Display', Georgia, serif;
					font-size: clamp(28px, 5vw, 36px);
					font-weight: 400;
					line-height: 1.15;
					letter-spacing: -0.03em;
					color: #0f0f0f;
					margin: 0 0 16px;
					animation: np-fadeUp 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-headline em {
					font-style: italic;
					color: ${primary};
					background: linear-gradient(90deg, ${primary}, ${primary}cc, ${primary});
					background-size: 200% auto;
					-webkit-background-clip: text;
					-webkit-text-fill-color: transparent;
					background-clip: text;
					animation: np-shimmer 3s linear infinite 1s;
				}

				.np-body {
					font-size: 14px;
					font-weight: 300;
					line-height: 1.7;
					color: #6b7280;
					margin: 0 0 36px;
					animation: np-fadeUp 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-company { font-weight: 500; color: #374151; }

				.np-status-pill {
					display: inline-flex;
					align-items: center;
					gap: 7px;
					padding: 7px 14px;
					background: rgba(${rgb.r},${rgb.g},${rgb.b},0.07);
					border: 1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.18);
					border-radius: 100px;
					font-size: 11.5px;
					font-weight: 500;
					color: ${primary};
					letter-spacing: 0.02em;
					animation: np-fadeUp 0.5s 0.32s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-dot {
					width: 6px; height: 6px;
					border-radius: 50%;
					background: ${primary};
					opacity: 0.5;
					animation: np-pulseDot 2s ease-in-out infinite;
				}

				.np-cta {
					display: inline-flex;
					align-items: center;
					gap: 8px;
					margin-top: 24px;
					padding: 10px 20px;
					background: ${primary};
					color: ${onPrimary};
					border-radius: 10px;
					font-size: 13px;
					font-weight: 500;
					text-decoration: none;
					transition: opacity 0.2s, transform 0.15s;
					animation: np-fadeUp 0.5s 0.38s cubic-bezier(0.16,1,0.3,1) both;
				}
				.np-cta:hover { opacity: 0.88; transform: translateY(-1px); }

				.np-footer {
					margin-top: auto;
					padding-top: 40px;
					padding-bottom: 8px;
					display: flex;
					justify-content: center;
					position: relative;
					z-index: 1;
					animation: np-fadeUp 0.5s 0.4s cubic-bezier(0.16,1,0.3,1) both;
				}

				.np-footer a {
					font-size: 11px;
					color: #9ca3af;
					text-decoration: none;
					letter-spacing: 0.03em;
					transition: color 0.2s;
				}
				.np-footer a:hover { color: #6b7280; }

				@media (max-width: 560px) {
					.np-card { padding: 40px 28px 36px; border-radius: 16px; }
				}
			`}</style>

			<div className="np-root">
				<div className="np-card">
					<div className="np-logo-wrap">
						{logo ? (
							<img src={logo} alt={companyName} className="np-logo-img" />
						) : (
							<div className="np-logo-placeholder">
								{companyName.charAt(0).toUpperCase()}
							</div>
						)}
					</div>

					<p className="np-eyebrow">{companyName}</p>
					<div className="np-divider" />

					<h1 className="np-headline">
						{headline ? (
							<span dangerouslySetInnerHTML={{ __html: headline }} />
						) : (
							<>Almost <em>ready</em> for you</>
						)}
					</h1>

					<p className="np-body">
						{body ? (
							body
						) : (
							<><span className="np-company">{companyName}</span> is putting the finishing
							touches on this form. Check back shortly — it'll be live soon.</>
						)}
					</p>

					{ctaLabel && ctaUrl ? (
						<a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="np-cta">
							{ctaLabel}
							<ArrowRight size={14} strokeWidth={2} />
						</a>
					) : (
						<div className="np-status-pill">
							<span className="np-dot" />
							Coming soon
						</div>
					)}
				</div>

				<footer className="np-footer">
					<Link to="/">Powered by Financely</Link>
				</footer>
			</div>
		</>
	);
}

// ─── Main Widget Page ─────────────────────────────────────────────────────────

export default function ModularWidgetPage() {
	const { organizationId, widgetId } = useParams<{
		organizationId: string;
		widgetId: string;
	}>();
	const [config, setConfig] = useState<{
		branding: BrandingData;
		pageConfig: WidgetPageConfig | null;
		widget: {
			name: string;
			versionId: string;
			pages: WidgetPage[];
			actions: WidgetVersionActions;
			multiStepOptions?: WidgetMultiStepOptions;
		};
	} | null>(null);
	const [configError, setConfigError] = useState<string | null>(null);
	const [errorBranding, setErrorBranding] = useState<BrandingData | null>(null);
	const [errorPageConfig, setErrorPageConfig] = useState<WidgetPageConfig | null>(null);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
	const [submitMessage, setSubmitMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;

	useEffect(() => {
		if (!organizationId || !widgetId) return;
		setConfigError(null);
		functionsService
			.getModularWidgetConfig({ organizationId, widgetId })
			.then((data) => {
				const pages = Array.isArray(data.widget.pages) ? data.widget.pages : [];
				const actions =
					data.widget.actions && typeof data.widget.actions === "object"
						? (data.widget.actions as WidgetVersionActions)
						: { success: { message: "Thank you!" } };
				const multiStepOptions =
					data.widget.multiStepOptions && typeof data.widget.multiStepOptions === "object"
						? data.widget.multiStepOptions
						: undefined;
				setConfig({
					branding: data.branding,
					pageConfig: (data as { pageConfig?: WidgetPageConfig | null }).pageConfig ?? null,
					widget: {
						name: data.widget.name,
						versionId: data.widget.versionId,
						pages,
						actions,
						multiStepOptions,
					},
				});
			})
			.catch((err) => {
				const msg = err instanceof Error ? err.message : "Failed to load widget";
				setConfigError(msg);
				if (err && typeof err === "object" && "branding" in err && (err as { branding?: unknown }).branding) {
					setErrorBranding((err as { branding: BrandingData }).branding);
				}
				if (err && typeof err === "object" && "pageConfig" in err) {
					setErrorPageConfig((err as { pageConfig?: WidgetPageConfig | null }).pageConfig ?? null);
				}
			});
	}, [organizationId, widgetId]);

	if (!organizationId || !widgetId) {
		return (
			<div className="min-h-screen w-screen max-w-none flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">Missing organization or widget</p>
			</div>
		);
	}

	if (configError) {
		if (configError === "Widget has no published version") {
			return (
				<NotPublishedPage
					branding={errorBranding}
					draftConfig={errorPageConfig?.draftState}
				/>
			);
		}
		return (
			<div className="min-h-screen w-screen max-w-none flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">{configError}</p>
			</div>
		);
	}

	if (!config) {
		return <LoadingScreen />;
	}

	const handleSubmit = async (payload: Record<string, string | boolean>) => {
		setSubmitting(true);
		setSubmitError(null);
		try {
			const res = await fetch(`${apiUrl}/submitModularWidget`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organizationId,
					widgetId,
					widgetVersionId: config.widget.versionId,
					data: payload,
				}),
			});
			const json = (await res.json().catch(() => ({}))) as {
				success?: boolean;
				error?: string;
				message?: string;
			};
			if (!res.ok) {
				setSubmitError(json.error ?? "Submit failed");
				return;
			}
			setSubmitStatus("success");
			setSubmitMessage(
				json.message ?? config.widget.actions.success?.message ?? "Thank you!",
			);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSubmitting(false);
		}
	};

	const colors = config.branding.colors ?? {};
	const primary = config.pageConfig?.primaryColor || colors.primary || "#2563eb";
	const secondary = colors.secondary ?? "#6b7280";
	const accent = colors.accent ?? "#10b981";
	const rgb = hexToRgb(primary);
	const layout: WidgetPageLayout = config.pageConfig?.layout ?? "split";

	const themeStyling: Partial<WidgetStyling> = {
		...defaultStyling,
		primaryColor: primary,
		secondaryColor: secondary,
		successColor: accent,
	};

	return (
		<BrandedLayout
			branding={config.branding}
			pageConfig={config.pageConfig}
			widgetName={config.widget.name}
			primary={primary}
			rgb={rgb}
			layout={layout}
			submitStatus={submitStatus}
			submitMessage={submitMessage}
			successMessage={config.widget.actions.success?.message}
			onResetSubmit={() => setSubmitStatus("idle")}
		>
			<WidgetSchemaRenderer
				pages={config.widget.pages}
				actions={config.widget.actions}
				styling={themeStyling}
				onSubmit={handleSubmit}
				submitting={submitting}
				submitError={submitError}
				multiStepOptions={config.widget.multiStepOptions}
			/>
		</BrandedLayout>
	);
}

// ─── Branded Layout ───────────────────────────────────────────────────────────

interface BrandedLayoutProps {
	branding: BrandingData;
	pageConfig: WidgetPageConfig | null;
	widgetName: string;
	primary: string;
	rgb: { r: number; g: number; b: number };
	layout: WidgetPageLayout;
	submitStatus: "idle" | "success" | "error";
	submitMessage: string;
	successMessage?: string;
	onResetSubmit: () => void;
	children: React.ReactNode;
}

interface SchemaDrivenLayoutProps {
	branding: BrandingData;
	widgetName: string;
	schema: WidgetPageSchema;
	primary: string;
	rgb: { r: number; g: number; b: number };
	submitStatus: "idle" | "success" | "error";
	submitMessage: string;
	successMessage?: string;
	onResetSubmit: () => void;
	children: React.ReactNode;
}

function SchemaDrivenLayout({
	branding,
	widgetName,
	schema,
	primary,
	rgb,
	submitStatus,
	submitMessage,
	successMessage,
	onResetSubmit,
	children,
}: SchemaDrivenLayoutProps) {
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

	const renderTrustIcon = (icon: WidgetPageTrustSignal["icon"]) => {
		if (icon === "shield") return <Shield size={13} strokeWidth={2} />;
		if (icon === "clock") return <Clock size={13} strokeWidth={2} />;
		if (icon === "star") return <Star size={13} strokeWidth={2} />;
		if (icon === "check") return <Check size={13} strokeWidth={2} />;
		return <Lock size={13} strokeWidth={2} />;
	};

	const renderBlocks = (
		blocks: WidgetPageSchemaBlock[],
		zone: "sidebar" | "main",
		depth = 0,
	): React.ReactNode => {
		return blocks.map((block) => {
			if (block.type === "stack") {
				const stackGap = block.gap === "sm" ? "space-y-2" : block.gap === "lg" ? "space-y-5" : "space-y-3";
				return (
					<div
						key={block.id}
						className={cn(
							"rounded-lg",
							zone === "sidebar" ? "bg-white/10 p-4" : "border border-border/70 bg-card p-4",
						)}
						style={depth > 0 ? { marginLeft: 8 } : undefined}
					>
						<div className={stackGap}>
							{renderBlocks(block.children, zone, depth + 1)}
						</div>
					</div>
				);
			}

			if (block.type === "logo") {
				return (
					<div key={block.id} className="flex items-center justify-start">
						{branding.logo ? (
							<img
								src={branding.logo}
								alt={branding.companyName}
								className="h-9 max-w-[160px] object-contain"
								style={{
									filter:
										zone === "sidebar" && sidebarOnPrimary === "#ffffff"
											? "brightness(0) invert(1)"
											: undefined,
								}}
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
					</div>
				);
			}

			if (block.type === "heading") {
				const HeadingTag: "h1" | "h2" | "h3" =
					block.level === 1 ? "h1" : block.level === 3 ? "h3" : "h2";
				return (
					<HeadingTag
						key={block.id}
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
					</HeadingTag>
				);
			}

			if (block.type === "text") {
				return (
					<p
						key={block.id}
						className={cn(
							"whitespace-pre-wrap text-sm leading-6",
							zone === "sidebar" ? "opacity-85" : "text-muted-foreground",
						)}
					>
						{block.text}
					</p>
				);
			}

			if (block.type === "list") {
				return (
					<ul key={block.id} className={cn("list-disc pl-5 space-y-1 text-sm", zone === "sidebar" ? "opacity-85" : "text-muted-foreground")}>
						{block.items.map((item, index) => (
							<li key={`${block.id}-list-${index}`}>{item}</li>
						))}
					</ul>
				);
			}

			if (block.type === "iconList") {
				return (
					<ul key={block.id} className="space-y-2">
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
					</ul>
				);
			}

			if (block.type === "policyLinks") {
				return (
					<nav key={block.id} className="flex flex-wrap gap-3">
						{sanitizeFooterLinks(block.links).map((link, index) => (
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
						))}
					</nav>
				);
			}

			if (block.type === "spacer") {
				const spacerClass = block.size === "sm" ? "h-3" : block.size === "lg" ? "h-10" : "h-6";
				return <div key={block.id} className={spacerClass} aria-hidden />;
			}

			return (
				<div key={block.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
					{submitStatus === "success" ? (
						<div className="flex flex-col items-center text-center py-8">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
								<CheckCircle2 className="h-8 w-8 text-primary" />
							</div>
							<h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2">All done!</h2>
							<p className="text-sm text-muted-foreground max-w-sm mb-4">
								{submitMessage || successMessage || "Thank you for your submission. We'll be in touch shortly."}
							</p>
							<button
								className="text-sm text-primary underline underline-offset-2"
								onClick={onResetSubmit}
							>
								Submit another response
							</button>
						</div>
					) : (
						<>
							<div className="mb-4">
								<p className="text-[10px] uppercase tracking-widest text-primary mb-1">
									{branding.companyName}
								</p>
								<h2 className="text-2xl font-semibold tracking-tight text-foreground">
									{block.title || widgetName || "Get in touch"}
								</h2>
								<p className="text-sm text-muted-foreground mt-1">
									{block.subtitle || "Fill in the details below and we'll get back to you."}
								</p>
							</div>
							{children}
						</>
					)}
				</div>
			);
		});
	};

	return (
		<div className="min-h-screen w-screen max-w-none" style={{ background: pageBackground }}>
			<div
				className="min-h-screen flex flex-col lg:grid"
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
					<div className="mt-auto pt-8">
						<Link to="/" className="text-xs opacity-70 hover:opacity-100">
							Powered by Financely
						</Link>
					</div>
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

function BrandedLayout({
	branding,
	pageConfig,
	widgetName,
	primary,
	rgb,
	layout,
	submitStatus,
	submitMessage,
	successMessage,
	onResetSubmit,
	children,
}: BrandedLayoutProps) {
	if (pageConfig?.schema?.version === 1) {
		return (
			<SchemaDrivenLayout
				branding={branding}
				widgetName={widgetName}
				schema={migrateToSchema(pageConfig, widgetName)}
				primary={primary}
				rgb={rgb}
				submitStatus={submitStatus}
				submitMessage={submitMessage}
				successMessage={successMessage}
				onResetSubmit={onResetSubmit}
			>
				{children}
			</SchemaDrivenLayout>
		);
	}

	const logo = branding.logo;
	const companyName = branding.companyName;

	const layoutBlocks = getLayoutBlocks(pageConfig);
	const sidePanelBlock = layoutBlocks.find(
		(block): block is WidgetPageSidePanelBlock => block.type === "sidePanel",
	);
	const topContentBlocks = layoutBlocks.filter(
		(block): block is WidgetPageCopyBlock | WidgetPagePolicyLinksBlock =>
			block.type !== "sidePanel" && block.position === "top",
	);
	const bottomContentBlocks = layoutBlocks.filter(
		(block): block is WidgetPageCopyBlock | WidgetPagePolicyLinksBlock =>
			block.type !== "sidePanel" && block.position === "bottom",
	);

	const sidePanelPrimary =
		sidePanelBlock?.primaryColor?.trim() ||
		pageConfig?.primaryColor?.trim() ||
		primary;
	const sidePanelOnPrimary = contrastColor(sidePanelPrimary);
	const sidePanelPosition = sidePanelBlock?.position ?? "left";
	const hideBrandPanel = !sidePanelBlock;
	const headline = sidePanelBlock?.title ?? pageConfig?.headline ?? null;
	const body = sidePanelBlock?.body ?? pageConfig?.body ?? null;
	const sidePanelTrustSignals = sanitizeTrustSignals(sidePanelBlock?.trustSignals);
	const trustSignalsToRender =
		sidePanelTrustSignals.length > 0
			? sidePanelTrustSignals
			: sanitizeTrustSignals(pageConfig?.trustSignals).length > 0
				? sanitizeTrustSignals(pageConfig?.trustSignals)
				: DEFAULT_TRUST_SIGNALS;
	const formTitle = pageConfig?.formTitle ?? null;
	const formSubtitle = pageConfig?.formSubtitle ?? null;
	const footerLinks = sanitizeFooterLinks(pageConfig?.footerLinks);
	const hasPolicyBlocks = layoutBlocks.some((block) => block.type === "policyLinks");
	const fallbackSideFooterLinks = hasPolicyBlocks ? [] : footerLinks;
	const backgroundStyle = pageConfig?.backgroundStyle ?? "clean";
	const rightPanelClass = hideBrandPanel
		? "wsp-right wsp-right-full"
		: sidePanelPosition === "right"
			? "wsp-right wsp-right-with-right"
			: "wsp-right wsp-right-with-left";

	const renderTrustIcon = (icon: WidgetPageTrustSignal["icon"]) => {
		if (icon === "shield") return <Shield size={13} strokeWidth={2} />;
		if (icon === "clock") return <Clock size={13} strokeWidth={2} />;
		if (icon === "star") return <Star size={13} strokeWidth={2} />;
		if (icon === "check") return <Check size={13} strokeWidth={2} />;
		return <Lock size={13} strokeWidth={2} />;
	};

	const renderContentBlock = (
		block: WidgetPageCopyBlock | WidgetPagePolicyLinksBlock,
		key: string,
	) => {
		if (block.type === "copy") {
			const title = block.title?.trim();
			const copyBody = block.body?.trim();
			if (!title && !copyBody) return null;
			return (
				<article key={key} className="wsp-content-block">
					{title ? <h3 className="wsp-content-block-title">{title}</h3> : null}
					{copyBody ? <p className="wsp-content-block-body">{copyBody}</p> : null}
				</article>
			);
		}
		const links = sanitizeFooterLinks(block.links);
		if (links.length === 0) return null;
		return (
			<article key={key} className="wsp-content-block">
				<nav className="wsp-content-policy-links">
					{links.map((link, index) => (
						<a key={`${key}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer">
							{link.label}
						</a>
					))}
				</nav>
			</article>
		);
	};

	// Centered layout
	if (layout === "centered") {
		return <CenteredLayout
			branding={branding}
			primary={primary}
			rgb={rgb}
			widgetName={widgetName}
			formTitle={formTitle}
			formSubtitle={formSubtitle}
			footerLinks={footerLinks}
			backgroundStyle={backgroundStyle}
			submitStatus={submitStatus}
			submitMessage={submitMessage}
			successMessage={successMessage}
			onResetSubmit={onResetSubmit}
		>
			{children}
		</CenteredLayout>;
	}

	// Minimal layout
	if (layout === "minimal") {
		return <MinimalLayout
			branding={branding}
			primary={primary}
			rgb={rgb}
			widgetName={widgetName}
			formTitle={formTitle}
			formSubtitle={formSubtitle}
			footerLinks={footerLinks}
			submitStatus={submitStatus}
			submitMessage={submitMessage}
			successMessage={successMessage}
			onResetSubmit={onResetSubmit}
		>
			{children}
		</MinimalLayout>;
	}

	// Default: split layout (with optional block-based side panel + content blocks)
	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');

				*, *::before, *::after { box-sizing: border-box; }

				.wsp-root {
					min-height: 100dvh;
					width: 100vw;
					max-width: none;
					display: flex;
					flex-direction: column;
					font-family: 'Geist', system-ui, sans-serif;
					background: ${backgroundStyle === "subtle-grid"
						? `#f8f7f5 url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 .5H31.5V32' fill='none' stroke='%23${primary.replace('#','')}' stroke-opacity='0.06' stroke-width='0.5'/%3E%3C/svg%3E")`
						: backgroundStyle === "gradient"
						? `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.04) 0%, #f8f7f5 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.02) 100%)`
						: "#f8f7f5"};
					overflow-x: hidden;
				}

				/* ── Main ── */
				.wsp-main {
					flex: 1;
					position: relative;
					display: flex;
					min-height: 100dvh;
				}

				/* ── Left panel ── */
				.wsp-left {
					position: fixed;
					top: 0;
					width: 380px;
					height: 100dvh;
					display: flex;
					flex-direction: column;
					padding: 56px 48px 40px;
					background: ${sidePanelPrimary};
					color: ${sidePanelOnPrimary};
					overflow: hidden;
					z-index: 10;
				}

				.wsp-left-left { left: 0; right: auto; }
				.wsp-left-right { right: 0; left: auto; }

				.wsp-left::before {
					content: '';
					position: absolute;
					inset: 0;
					background:
						radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.12) 0%, transparent 60%),
						radial-gradient(ellipse at 0% 100%, rgba(0,0,0,0.12) 0%, transparent 50%);
					pointer-events: none;
				}

				.wsp-left-noise {
					position: absolute;
					inset: 0;
					opacity: 0.03;
					background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
					pointer-events: none;
				}

				.wsp-left-content {
					position: relative;
					z-index: 1;
					display: flex;
					flex-direction: column;
					height: 100%;
				}

				.wsp-left-logo-wrap { margin-bottom: 48px; }

				.wsp-left-logo-img {
					height: 36px;
					max-width: 160px;
					object-fit: contain;
					filter: ${sidePanelOnPrimary === "#ffffff" ? "brightness(0) invert(1)" : "brightness(0)"};
					opacity: 0.9;
				}

				.wsp-left-logo-text {
					font-size: 18px;
					font-weight: 600;
					letter-spacing: -0.03em;
					opacity: 0.95;
				}

				.wsp-left-eyebrow {
					font-size: 10px;
					font-weight: 500;
					letter-spacing: 0.2em;
					text-transform: uppercase;
					opacity: 0.5;
					margin-bottom: 12px;
				}

				.wsp-left-headline {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(28px, 3.5vw, 40px);
					font-weight: 400;
					line-height: 1.12;
					letter-spacing: -0.025em;
					margin: 0 0 20px;
					opacity: 0.97;
				}

				.wsp-left-headline em { font-style: italic; opacity: 0.75; }

				.wsp-left-body {
					font-size: 14px;
					font-weight: 300;
					line-height: 1.7;
					opacity: 0.65;
					margin: 0 0 40px;
					max-width: 280px;
				}

				.wsp-left-trust-list {
					list-style: none;
					padding: 0; margin: 0;
					display: flex;
					flex-direction: column;
					gap: 14px;
				}

				.wsp-left-trust-item {
					display: flex;
					align-items: center;
					gap: 10px;
					font-size: 13px;
					font-weight: 400;
					opacity: 0.7;
				}

				.wsp-left-trust-icon {
					width: 28px; height: 28px;
					border-radius: 7px;
					background: rgba(255,255,255,0.12);
					display: flex;
					align-items: center;
					justify-content: center;
					flex-shrink: 0;
				}

				.wsp-left-bottom { margin-top: auto; padding-top: 32px; }

				.wsp-left-divider {
					width: 32px; height: 1px;
					background: rgba(255,255,255,0.25);
					margin-bottom: 16px;
				}

				.wsp-left-powered {
					font-size: 10px;
					opacity: 0.35;
					letter-spacing: 0.05em;
				}

				/* ── Right panel ── */
				.wsp-right {
					flex: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					padding: 56px 40px 80px;
				}
				.wsp-right-with-left { margin-left: 380px; margin-right: 0; }
				.wsp-right-with-right { margin-right: 380px; margin-left: 0; }

				.wsp-right-inner {
					width: 100%;
					max-width: 520px;
				}

				.wsp-right-full { margin-left: 0; margin-right: 0; }

				.wsp-left-footer-links {
					display: flex;
					flex-direction: column;
					gap: 8px;
					margin-bottom: 10px;
				}

				.wsp-left-footer-links a {
					font-size: 11px;
					opacity: 0.45;
					color: inherit;
					text-decoration: underline;
					text-underline-offset: 3px;
					transition: opacity 0.2s;
				}
				.wsp-left-footer-links a:hover { opacity: 0.7; }

				.wsp-right-header { margin-bottom: 32px; }

				.wsp-right-label {
					font-size: 10px;
					font-weight: 500;
					letter-spacing: 0.18em;
					text-transform: uppercase;
					color: ${primary};
					margin-bottom: 8px;
					display: block;
				}

				.wsp-right-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(22px, 3vw, 30px);
					font-weight: 400;
					letter-spacing: -0.02em;
					color: #111;
					margin: 0 0 6px;
					line-height: 1.2;
				}

				.wsp-right-subtitle {
					font-size: 14px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.6;
					margin: 0;
				}

				.wsp-widget-card {
					background: #fff;
					border-radius: 16px;
					border: 1px solid rgba(0,0,0,0.07);
					box-shadow:
						0 0 0 1px rgba(255,255,255,0.8) inset,
						0 4px 24px rgba(${rgb.r},${rgb.g},${rgb.b},0.07),
						0 1px 3px rgba(0,0,0,0.04);
					overflow: hidden;
					padding: 28px;
				}

				.wsp-content-blocks {
					display: flex;
					flex-direction: column;
					gap: 10px;
					margin-bottom: 16px;
				}
				.wsp-content-blocks-bottom { margin-top: 16px; margin-bottom: 0; }
				.wsp-content-block {
					background: rgba(255,255,255,0.82);
					border: 1px solid rgba(17,24,39,0.08);
					border-radius: 12px;
					padding: 14px 16px;
				}
				.wsp-content-block-title {
					font-size: 14px;
					font-weight: 600;
					color: #111827;
					margin: 0 0 4px;
				}
				.wsp-content-block-body {
					font-size: 13px;
					color: #4b5563;
					line-height: 1.6;
					margin: 0;
				}
				.wsp-content-policy-links {
					display: flex;
					flex-wrap: wrap;
					gap: 12px;
				}
				.wsp-content-policy-links a {
					font-size: 12px;
					color: ${primary};
					text-decoration: underline;
					text-underline-offset: 2px;
				}

				/* ── Success state ── */
				.wsp-success-wrap {
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					padding: 48px 24px;
				}

				.wsp-success-icon-ring {
					width: 72px; height: 72px;
					border-radius: 50%;
					background: rgba(${rgb.r},${rgb.g},${rgb.b},0.08);
					display: flex;
					align-items: center;
					justify-content: center;
					margin-bottom: 24px;
				}

				.wsp-success-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: 26px;
					font-weight: 400;
					letter-spacing: -0.02em;
					color: #111;
					margin: 0 0 10px;
				}

				.wsp-success-body {
					font-size: 15px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.65;
					margin: 0 0 28px;
					max-width: 340px;
				}

				.wsp-success-reset {
					font-size: 13px;
					color: ${primary};
					background: none;
					border: none;
					cursor: pointer;
					padding: 8px 0;
					font-weight: 500;
					text-decoration: underline;
					text-underline-offset: 3px;
					font-family: inherit;
					opacity: 0.8;
					transition: opacity 0.2s;
				}
				.wsp-success-reset:hover { opacity: 1; }

				/* ── Animations ── */
				@keyframes wsp-fade-in {
					from { opacity: 0; transform: translateY(14px); }
					to   { opacity: 1; transform: translateY(0); }
				}

				.wsp-left-content > * { animation: wsp-fade-in 0.5s ease both; }
				.wsp-left-content > *:nth-child(1) { animation-delay: 0.05s; }
				.wsp-left-content > *:nth-child(2) { animation-delay: 0.12s; }
				.wsp-left-content > *:nth-child(3) { animation-delay: 0.18s; }
				.wsp-left-content > *:nth-child(4) { animation-delay: 0.25s; }
				.wsp-left-content > *:nth-child(5) { animation-delay: 0.32s; }
				.wsp-right-header { animation: wsp-fade-in 0.5s 0.2s ease both; }
				.wsp-widget-card { animation: wsp-fade-in 0.5s 0.3s ease both; }
				.wsp-success-wrap > * { animation: wsp-fade-in 0.5s ease both; }
				.wsp-success-wrap > *:nth-child(1) { animation-delay: 0s; }
				.wsp-success-wrap > *:nth-child(2) { animation-delay: 0.08s; }
				.wsp-success-wrap > *:nth-child(3) { animation-delay: 0.16s; }
				.wsp-success-wrap > *:nth-child(4) { animation-delay: 0.22s; }

				/* ── Responsive ── */
				@media (max-width: 900px) {
					.wsp-main { flex-direction: column; }
					.wsp-left {
						position: relative; top: 0; left: 0; right: 0;
						width: 100%; height: auto;
						min-height: unset;
						padding: 40px 32px 36px;
						z-index: auto;
					}
					.wsp-left-headline { font-size: 26px; }
					.wsp-left-body { display: none; }
					.wsp-left-trust-list { flex-direction: row; flex-wrap: wrap; gap: 10px; }
					.wsp-left-bottom { display: none; }
					.wsp-right { margin-left: 0; margin-right: 0; padding: 36px 20px 60px; }
				}

				@media (max-width: 480px) {
					.wsp-left { padding: 32px 20px 28px; }
					.wsp-widget-card { padding: 20px; border-radius: 12px; }
				}
			`}</style>

			<div className="wsp-root">
				<main className="wsp-main">
					{/* ── Left branding panel ── */}
					{!hideBrandPanel && (
						<aside className={sidePanelPosition === "right" ? "wsp-left wsp-left-right" : "wsp-left wsp-left-left"}>
							<div className="wsp-left-noise" aria-hidden />
							<div className="wsp-left-content">
								{/* Logo */}
								<div className="wsp-left-logo-wrap">
									{logo ? (
										<img src={logo} alt={companyName} className="wsp-left-logo-img" />
									) : (
										<span className="wsp-left-logo-text">{companyName}</span>
									)}
								</div>

								{/* Eyebrow */}
								<p className="wsp-left-eyebrow">{companyName}</p>

								{/* Headline */}
								<h1 className="wsp-left-headline">
									{headline || widgetName || <>Fill out the form <em>&amp; we'll be in touch</em></>}
								</h1>

								{/* Body copy */}
								<p className="wsp-left-body">
									{body || "Complete the form and our team will review your submission. We typically respond within one business day."}
								</p>

								{/* Trust signals */}
								<ul className="wsp-left-trust-list">
									{trustSignalsToRender.map((signal, i) => (
										<li key={i} className="wsp-left-trust-item">
											<span className="wsp-left-trust-icon">{renderTrustIcon(signal.icon)}</span>
											{signal.label}
										</li>
									))}
								</ul>

								{/* Footer */}
								<div className="wsp-left-bottom">
									<div className="wsp-left-divider" />
									{fallbackSideFooterLinks.length > 0 && (
										<nav className="wsp-left-footer-links">
											{fallbackSideFooterLinks.map((link, i) => (
												<a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
													{link.label}
												</a>
											))}
										</nav>
									)}
									<Link to="/" style={{ textDecoration: "none" }}>
										<p className="wsp-left-powered">Powered by Financely</p>
									</Link>
								</div>
							</div>
						</aside>
					)}

					{/* ── Right widget panel ── */}
					<section className={rightPanelClass}>
						<div className="wsp-right-inner">
							{topContentBlocks.length > 0 && (
								<div className="wsp-content-blocks">
									{topContentBlocks.map((block, index) =>
										renderContentBlock(block, `top-${index}`),
									)}
								</div>
							)}
							{submitStatus === "success" ? (
								<div className="wsp-widget-card">
									<div className="wsp-success-wrap">
										<div className="wsp-success-icon-ring">
											<CheckCircle2
												size={32}
												strokeWidth={1.5}
												style={{ color: primary }}
											/>
										</div>
										<h2 className="wsp-success-title">All done!</h2>
										<p className="wsp-success-body">
											{submitMessage || successMessage || "Thank you for your submission. We'll be in touch shortly."}
										</p>
										<button className="wsp-success-reset" onClick={onResetSubmit}>
											Submit another response
										</button>
									</div>
								</div>
							) : (
								<>
									<div className="wsp-right-header">
										<span className="wsp-right-label">{companyName}</span>
										<h2 className="wsp-right-title">{formTitle || widgetName || "Get in touch"}</h2>
										<p className="wsp-right-subtitle">
											{formSubtitle || "Fill in the details below and we'll get back to you."}
										</p>
									</div>
									<div className="wsp-widget-card">{children}</div>
								</>
							)}
							{bottomContentBlocks.length > 0 && (
								<div className="wsp-content-blocks wsp-content-blocks-bottom">
									{bottomContentBlocks.map((block, index) =>
										renderContentBlock(block, `bottom-${index}`),
									)}
								</div>
							)}
						</div>
					</section>
				</main>
			</div>
		</>
	);
}

// ─── Centered Layout ──────────────────────────────────────────────────────────

interface CenteredLayoutProps {
	branding: BrandingData;
	primary: string;
	rgb: { r: number; g: number; b: number };
	widgetName: string;
	formTitle: string | null;
	formSubtitle: string | null;
	footerLinks: Array<{ label: string; url: string }>;
	backgroundStyle: string;
	submitStatus: "idle" | "success" | "error";
	submitMessage: string;
	successMessage?: string;
	onResetSubmit: () => void;
	children: React.ReactNode;
}

function CenteredLayout({
	branding,
	primary,
	rgb,
	widgetName,
	formTitle,
	formSubtitle,
	footerLinks,
	backgroundStyle,
	submitStatus,
	submitMessage,
	successMessage,
	onResetSubmit,
	children,
}: CenteredLayoutProps) {
	const logo = branding.logo;
	const companyName = branding.companyName;

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');
				*, *::before, *::after { box-sizing: border-box; }

				.wcc-root {
					min-height: 100dvh;
					width: 100vw;
					max-width: none;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					font-family: 'Geist', system-ui, sans-serif;
					background: ${backgroundStyle === "subtle-grid"
						? `#f8f7f5 url("data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 .5H31.5V32' fill='none' stroke='%23${primary.replace('#','')}' stroke-opacity='0.06' stroke-width='0.5'/%3E%3C/svg%3E")`
						: backgroundStyle === "gradient"
						? `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.04) 0%, #f8f7f5 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.02) 100%)`
						: "#f8f7f5"};
					padding: 60px 24px 80px;
					overflow-x: hidden;
				}

				.wcc-header {
					width: 100%;
					max-width: 560px;
					text-align: center;
					margin-bottom: 40px;
				}

				.wcc-logo-wrap {
					display: flex;
					justify-content: center;
					margin-bottom: 28px;
				}

				.wcc-logo-img {
					height: 40px;
					max-width: 160px;
					object-fit: contain;
				}

				.wcc-logo-placeholder {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 48px; height: 48px;
					border-radius: 12px;
					background: ${primary}1a;
					border: 1px solid ${primary}33;
					font-size: 18px;
					font-weight: 700;
					color: ${primary};
					font-family: 'Instrument Serif', Georgia, serif;
				}

				.wcc-company {
					font-size: 10px;
					font-weight: 500;
					letter-spacing: 0.2em;
					text-transform: uppercase;
					color: ${primary};
					opacity: 0.7;
					margin-bottom: 10px;
				}

				.wcc-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(26px, 4vw, 36px);
					font-weight: 400;
					letter-spacing: -0.025em;
					color: #111;
					margin: 0 0 10px;
					line-height: 1.15;
				}

				.wcc-subtitle {
					font-size: 15px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.65;
					margin: 0;
				}

				.wcc-card {
					width: 100%;
					max-width: 560px;
					background: #fff;
					border-radius: 20px;
					border: 1px solid rgba(0,0,0,0.07);
					box-shadow:
						0 0 0 1px rgba(255,255,255,0.8) inset,
						0 8px 32px rgba(${rgb.r},${rgb.g},${rgb.b},0.08),
						0 2px 6px rgba(0,0,0,0.04);
					padding: 36px;
				}

				.wcc-success-wrap {
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					padding: 48px 24px;
				}

				.wcc-success-icon-ring {
					width: 72px; height: 72px;
					border-radius: 50%;
					background: rgba(${rgb.r},${rgb.g},${rgb.b},0.08);
					display: flex;
					align-items: center;
					justify-content: center;
					margin-bottom: 24px;
				}

				.wcc-success-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: 26px;
					font-weight: 400;
					letter-spacing: -0.02em;
					color: #111;
					margin: 0 0 10px;
				}

				.wcc-success-body {
					font-size: 15px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.65;
					margin: 0 0 28px;
					max-width: 340px;
				}

				.wcc-success-reset {
					font-size: 13px;
					color: ${primary};
					background: none;
					border: none;
					cursor: pointer;
					padding: 8px 0;
					font-weight: 500;
					text-decoration: underline;
					text-underline-offset: 3px;
					font-family: inherit;
					opacity: 0.8;
					transition: opacity 0.2s;
				}
				.wcc-success-reset:hover { opacity: 1; }

				.wcc-footer {
					margin-top: 32px;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 8px;
				}

				.wcc-footer-links {
					display: flex;
					gap: 16px;
					flex-wrap: wrap;
					justify-content: center;
				}

				.wcc-footer-links a {
					font-size: 11px;
					color: #9ca3af;
					text-decoration: none;
					transition: color 0.2s;
				}
				.wcc-footer-links a:hover { color: #6b7280; }

				.wcc-powered {
					font-size: 11px;
					color: #d1d5db;
					text-decoration: none;
					letter-spacing: 0.03em;
					transition: color 0.2s;
				}
				.wcc-powered:hover { color: #9ca3af; }

				@keyframes wcc-fade-in {
					from { opacity: 0; transform: translateY(12px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				.wcc-header { animation: wcc-fade-in 0.5s 0.05s ease both; }
				.wcc-card { animation: wcc-fade-in 0.5s 0.15s ease both; }
				.wcc-footer { animation: wcc-fade-in 0.5s 0.25s ease both; }

				@media (max-width: 600px) {
					.wcc-root { padding: 40px 16px 60px; }
					.wcc-card { padding: 24px; border-radius: 16px; }
				}
			`}</style>

			<div className="wcc-root">
				<header className="wcc-header">
					<div className="wcc-logo-wrap">
						{logo ? (
							<img src={logo} alt={companyName} className="wcc-logo-img" />
						) : (
							<div className="wcc-logo-placeholder">
								{companyName.charAt(0).toUpperCase()}
							</div>
						)}
					</div>
					<p className="wcc-company">{companyName}</p>
					{submitStatus !== "success" && (
						<>
							<h1 className="wcc-title">{formTitle || widgetName || "Get in touch"}</h1>
							<p className="wcc-subtitle">
								{formSubtitle || "Fill in the details below and we'll get back to you."}
							</p>
						</>
					)}
				</header>

				<div className="wcc-card">
					{submitStatus === "success" ? (
						<div className="wcc-success-wrap">
							<div className="wcc-success-icon-ring">
								<CheckCircle2 size={32} strokeWidth={1.5} style={{ color: primary }} />
							</div>
							<h2 className="wcc-success-title">All done!</h2>
							<p className="wcc-success-body">
								{submitMessage || successMessage || "Thank you for your submission. We'll be in touch shortly."}
							</p>
							<button className="wcc-success-reset" onClick={onResetSubmit}>
								Submit another response
							</button>
						</div>
					) : (
						children
					)}
				</div>

				<footer className="wcc-footer">
					{footerLinks.length > 0 && (
						<nav className="wcc-footer-links">
							{footerLinks.map((link, i) => (
								<a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
									{link.label}
								</a>
							))}
						</nav>
					)}
					<Link to="/" className="wcc-powered">Powered by Financely</Link>
				</footer>
			</div>
		</>
	);
}

// ─── Minimal Layout ───────────────────────────────────────────────────────────

interface MinimalLayoutProps {
	branding: BrandingData;
	primary: string;
	rgb: { r: number; g: number; b: number };
	widgetName: string;
	formTitle: string | null;
	formSubtitle: string | null;
	footerLinks: Array<{ label: string; url: string }>;
	submitStatus: "idle" | "success" | "error";
	submitMessage: string;
	successMessage?: string;
	onResetSubmit: () => void;
	children: React.ReactNode;
}

function MinimalLayout({
	branding,
	primary,
	rgb,
	widgetName,
	formTitle,
	formSubtitle,
	footerLinks,
	submitStatus,
	submitMessage,
	successMessage,
	onResetSubmit,
	children,
}: MinimalLayoutProps) {
	const logo = branding.logo;
	const companyName = branding.companyName;

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');
				*, *::before, *::after { box-sizing: border-box; }

				.wml-root {
					min-height: 100dvh;
					width: 100vw;
					max-width: none;
					background: #fff;
					display: flex;
					flex-direction: column;
					font-family: 'Geist', system-ui, sans-serif;
					overflow-x: hidden;
				}

				.wml-nav {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 20px 40px;
					border-bottom: 1px solid rgba(0,0,0,0.06);
				}

				.wml-nav-logo-img {
					height: 28px;
					max-width: 120px;
					object-fit: contain;
				}

				.wml-nav-logo-text {
					font-size: 15px;
					font-weight: 600;
					letter-spacing: -0.03em;
					color: #111;
				}

				.wml-nav-powered {
					font-size: 11px;
					color: #d1d5db;
					text-decoration: none;
					letter-spacing: 0.03em;
					transition: color 0.2s;
				}
				.wml-nav-powered:hover { color: #9ca3af; }

				.wml-content {
					flex: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					padding: 64px 24px 80px;
				}

				.wml-title-block {
					width: 100%;
					max-width: 440px;
					margin-bottom: 32px;
				}

				.wml-accent-bar {
					width: 32px; height: 2px;
					background: ${primary};
					border-radius: 2px;
					margin-bottom: 20px;
				}

				.wml-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(22px, 3.5vw, 32px);
					font-weight: 400;
					letter-spacing: -0.025em;
					color: #111;
					margin: 0 0 8px;
					line-height: 1.18;
				}

				.wml-subtitle {
					font-size: 14px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.65;
					margin: 0;
				}

				.wml-form-wrap {
					width: 100%;
					max-width: 440px;
				}

				.wml-success-wrap {
					width: 100%;
					max-width: 440px;
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					padding: 40px 0;
				}

				.wml-success-icon {
					width: 48px; height: 48px;
					border-radius: 12px;
					background: rgba(${rgb.r},${rgb.g},${rgb.b},0.08);
					display: flex;
					align-items: center;
					justify-content: center;
					margin-bottom: 20px;
				}

				.wml-success-title {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: 24px;
					font-weight: 400;
					letter-spacing: -0.02em;
					color: #111;
					margin: 0 0 8px;
				}

				.wml-success-body {
					font-size: 14px;
					color: #6b7280;
					font-weight: 300;
					line-height: 1.65;
					margin: 0 0 24px;
				}

				.wml-success-reset {
					font-size: 13px;
					color: ${primary};
					background: none;
					border: none;
					cursor: pointer;
					padding: 0;
					font-weight: 500;
					text-decoration: underline;
					text-underline-offset: 3px;
					font-family: inherit;
					opacity: 0.8;
					transition: opacity 0.2s;
				}
				.wml-success-reset:hover { opacity: 1; }

				.wml-footer {
					padding: 20px 40px;
					border-top: 1px solid rgba(0,0,0,0.06);
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					flex-wrap: wrap;
				}

				.wml-footer-links {
					display: flex;
					gap: 16px;
					flex-wrap: wrap;
				}

				.wml-footer-links a {
					font-size: 11px;
					color: #9ca3af;
					text-decoration: none;
					transition: color 0.2s;
				}
				.wml-footer-links a:hover { color: #6b7280; }

				@keyframes wml-fade-in {
					from { opacity: 0; transform: translateY(10px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				.wml-title-block { animation: wml-fade-in 0.4s 0.05s ease both; }
				.wml-form-wrap { animation: wml-fade-in 0.4s 0.12s ease both; }
				.wml-success-wrap { animation: wml-fade-in 0.4s ease both; }

				@media (max-width: 600px) {
					.wml-nav { padding: 16px 20px; }
					.wml-content { padding: 40px 20px 60px; }
					.wml-footer { padding: 16px 20px; }
				}
			`}</style>

			<div className="wml-root">
				<nav className="wml-nav">
					{logo ? (
						<img src={logo} alt={companyName} className="wml-nav-logo-img" />
					) : (
						<span className="wml-nav-logo-text">{companyName}</span>
					)}
					<Link to="/" className="wml-nav-powered">Powered by Financely</Link>
				</nav>

				<div className="wml-content">
					{submitStatus === "success" ? (
						<div className="wml-success-wrap">
							<div className="wml-success-icon">
								<CheckCircle2 size={24} strokeWidth={1.5} style={{ color: primary }} />
							</div>
							<h1 className="wml-success-title">All done!</h1>
							<p className="wml-success-body">
								{submitMessage || successMessage || "Thank you for your submission. We'll be in touch shortly."}
							</p>
							<button className="wml-success-reset" onClick={onResetSubmit}>
								Submit another response
							</button>
						</div>
					) : (
						<>
							<div className="wml-title-block">
								<div className="wml-accent-bar" />
								<h1 className="wml-title">{formTitle || widgetName || "Get in touch"}</h1>
								<p className="wml-subtitle">
									{formSubtitle || "Fill in the details below and we'll get back to you."}
								</p>
							</div>
							<div className="wml-form-wrap">{children}</div>
						</>
					)}
				</div>

				<footer className="wml-footer">
					{footerLinks.length > 0 ? (
						<nav className="wml-footer-links">
							{footerLinks.map((link, i) => (
								<a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
									{link.label}
								</a>
							))}
						</nav>
					) : (
						<span />
					)}
					<Link to="/" className="wml-nav-powered">Powered by Financely</Link>
				</footer>
			</div>
		</>
	);
}

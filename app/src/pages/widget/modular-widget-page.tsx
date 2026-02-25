import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Shield, Clock, Star, Check, Lock } from "lucide-react";
import { LoadingScreen } from "@/components/loading-screen";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type { WidgetVersionActions } from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";
import { projectId } from "@/infrastructure/firebase";
import { functionsService } from "@/services/functions/functions-service";
import type { WidgetMultiStepOptions } from "@/core/entities/widget-version";
import { WidgetPage } from "@/core/entities/widget-block-schema";
import type { WidgetPageConfig } from "@/core/entities/widget-definition";

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

/** Returns whether to use white or dark text on a given hex background */
function contrastColor(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.55 ? "#111827" : "#ffffff";
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

function NotPublishedPage({ branding }: { branding: BrandingData | null }) {
	const primary = branding?.colors?.primary ?? "#111827";
	const companyName = branding?.companyName ?? "This widget";
	const logo = branding?.logo;
	const rgb = hexToRgb(primary);
	const onPrimary = contrastColor(primary);

	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

				@keyframes fadeUp {
					from { opacity: 0; transform: translateY(18px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				@keyframes scaleIn {
					from { opacity: 0; transform: scale(0.92); }
					to   { opacity: 1; transform: scale(1); }
				}
				@keyframes lineDraw {
					from { transform: scaleX(0); }
					to   { transform: scaleX(1); }
				}
				@keyframes shimmer {
					0%   { background-position: -200% center; }
					100% { background-position: 200% center; }
				}
				@keyframes orbFloat {
					0%, 100% { transform: translateY(0px) translateX(0px); }
					33%       { transform: translateY(-14px) translateX(6px); }
					66%       { transform: translateY(8px) translateX(-10px); }
				}

				.not-published-root {
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

				.not-published-root::before {
					content: '';
					position: absolute;
					top: -180px;
					right: -180px;
					width: 520px;
					height: 520px;
					border-radius: 50%;
					background: radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},0.12) 0%, transparent 70%);
					animation: orbFloat 12s ease-in-out infinite;
					pointer-events: none;
				}

				.not-published-root::after {
					content: '';
					position: absolute;
					bottom: -120px;
					left: -120px;
					width: 380px;
					height: 380px;
					border-radius: 50%;
					background: radial-gradient(circle, rgba(${rgb.r},${rgb.g},${rgb.b},0.08) 0%, transparent 70%);
					animation: orbFloat 16s ease-in-out infinite reverse;
					pointer-events: none;
				}

				.not-published-card {
					position: relative;
					z-index: 1;
					width: 100%;
					max-width: 520px;
					background: rgba(255,255,255,0.85);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					border: 1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.14);
					border-radius: 20px;
					padding: 52px 48px 44px;
					box-shadow:
						0 0 0 1px rgba(255,255,255,0.6) inset,
						0 8px 40px rgba(${rgb.r},${rgb.g},${rgb.b},0.10),
						0 2px 8px rgba(0,0,0,0.04);
					animation: scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
					text-align: center;
				}

				.not-published-logo-wrap {
					display: flex;
					justify-content: center;
					margin-bottom: 28px;
					animation: fadeUp 0.5s 0.05s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-logo-img {
					height: 48px;
					max-width: 160px;
					object-fit: contain;
				}

				.not-published-logo-placeholder {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 56px;
					height: 56px;
					border-radius: 14px;
					background: linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.15), rgba(${rgb.r},${rgb.g},${rgb.b},0.06));
					border: 1px solid rgba(${rgb.r},${rgb.g},${rgb.b},0.2);
					font-size: 22px;
					font-weight: 700;
					color: ${primary};
					font-family: 'DM Serif Display', Georgia, serif;
					letter-spacing: -0.5px;
				}

				.not-published-divider {
					width: 48px;
					height: 2px;
					background: ${primary};
					border-radius: 2px;
					margin: 0 auto 28px;
					transform-origin: left;
					animation: lineDraw 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-eyebrow {
					font-size: 10px;
					font-weight: 500;
					letter-spacing: 0.18em;
					text-transform: uppercase;
					color: ${primary};
					opacity: 0.7;
					margin-bottom: 12px;
					animation: fadeUp 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-headline {
					font-family: 'DM Serif Display', Georgia, serif;
					font-size: clamp(28px, 5vw, 36px);
					font-weight: 400;
					line-height: 1.15;
					letter-spacing: -0.03em;
					color: #0f0f0f;
					margin: 0 0 16px;
					animation: fadeUp 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-headline em {
					font-style: italic;
					color: ${primary};
					background: linear-gradient(90deg, ${primary}, ${primary}cc, ${primary});
					background-size: 200% auto;
					-webkit-background-clip: text;
					-webkit-text-fill-color: transparent;
					background-clip: text;
					animation: shimmer 3s linear infinite 1s;
				}

				.not-published-body {
					font-size: 14px;
					font-weight: 300;
					line-height: 1.7;
					color: #6b7280;
					margin: 0 0 36px;
					animation: fadeUp 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-company {
					font-weight: 500;
					color: #374151;
				}

				.not-published-status-pill {
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
					animation: fadeUp 0.5s 0.32s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-dot {
					width: 6px;
					height: 6px;
					border-radius: 50%;
					background: ${primary};
					opacity: 0.5;
					animation: pulse-dot 2s ease-in-out infinite;
				}

				@keyframes pulse-dot {
					0%, 100% { opacity: 0.5; transform: scale(1); }
					50%       { opacity: 1; transform: scale(1.3); }
				}

				.not-published-footer {
					margin-top: auto;
					padding-top: 40px;
					padding-bottom: 8px;
					display: flex;
					justify-content: center;
					position: relative;
					z-index: 1;
					animation: fadeUp 0.5s 0.4s cubic-bezier(0.16,1,0.3,1) both;
				}

				.not-published-footer a {
					font-size: 11px;
					color: #9ca3af;
					text-decoration: none;
					letter-spacing: 0.03em;
					transition: color 0.2s;
				}
				.not-published-footer a:hover { color: #6b7280; }

				@media (max-width: 560px) {
					.not-published-card {
						padding: 40px 28px 36px;
						border-radius: 16px;
					}
				}
			`}</style>

			<div className="not-published-root">
				<div className="not-published-card">
					<div className="not-published-logo-wrap">
						{logo ? (
							<img
								src={logo}
								alt={companyName}
								className="not-published-logo-img"
							/>
						) : (
							<div className="not-published-logo-placeholder">
								{companyName.charAt(0).toUpperCase()}
							</div>
						)}
					</div>

					<p className="not-published-eyebrow">{companyName}</p>
					<div className="not-published-divider" />

					<h1 className="not-published-headline">
						Almost <em>ready</em> for you
					</h1>

					<p className="not-published-body">
						<span className="not-published-company">{companyName}</span> is
						putting the finishing touches on this form. Check back shortly —
						it'll be live soon.
					</p>

					<div className="not-published-status-pill">
						<span className="not-published-dot" />
						Coming soon
					</div>
				</div>

				<footer className="not-published-footer">
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
			return <NotPublishedPage branding={errorBranding} />;
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
	const onPrimary = contrastColor(primary);

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
			onPrimary={onPrimary}
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
	onPrimary: string;
	submitStatus: "idle" | "success" | "error";
	submitMessage: string;
	successMessage?: string;
	onResetSubmit: () => void;
	children: React.ReactNode;
}

function BrandedLayout({
	branding,
	pageConfig,
	widgetName,
	primary,
	rgb,
	onPrimary,
	submitStatus,
	submitMessage,
	successMessage,
	onResetSubmit,
	children,
}: BrandedLayoutProps) {
	const logo = branding.logo;
	const companyName = branding.companyName;

	// Resolved page config values (with defaults)
	const headline = pageConfig?.headline || null;
	const body = pageConfig?.body || null;
	const hideBrandPanel = pageConfig?.hideBrandPanel ?? false;
	const formTitle = pageConfig?.formTitle || null;
	const formSubtitle = pageConfig?.formSubtitle || null;
	const footerLinks = pageConfig?.footerLinks ?? [];
	const showPoweredBy = pageConfig?.showPoweredBy ?? true;
	const customTrustSignals = pageConfig?.trustSignals ?? null;

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
					background: #f8f7f5;
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
					left: 0;
					width: 380px;
					height: 100dvh;
					display: flex;
					flex-direction: column;
					padding: 56px 48px 40px;
					background: ${primary};
					color: ${onPrimary};
					overflow: hidden;
					z-index: 10;
				}

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

				.wsp-left-logo-wrap {
					margin-bottom: 48px;
				}

				.wsp-left-logo-img {
					height: 36px;
					max-width: 160px;
					object-fit: contain;
					filter: ${onPrimary === "#ffffff" ? "brightness(0) invert(1)" : "brightness(0)"};
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

				.wsp-left-headline em {
					font-style: italic;
					opacity: 0.75;
				}

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
					padding: 0;
					margin: 0;
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
					width: 28px;
					height: 28px;
					border-radius: 7px;
					background: rgba(255,255,255,0.12);
					display: flex;
					align-items: center;
					justify-content: center;
					flex-shrink: 0;
				}

				.wsp-left-bottom {
					margin-top: auto;
					padding-top: 32px;
				}

				.wsp-left-divider {
					width: 32px;
					height: 1px;
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
					margin-left: 380px;
					flex: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					padding: 56px 40px 80px;
				}

				.wsp-right-inner {
					width: 100%;
					max-width: 520px;
				}

				.wsp-right-full {
					margin-left: 0;
				}

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

				.wsp-right-header {
					margin-bottom: 32px;
				}

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

				/* ── Success state ── */
				.wsp-success-wrap {
					display: flex;
					flex-direction: column;
					align-items: center;
					text-align: center;
					padding: 48px 24px;
				}

				.wsp-success-icon-ring {
					width: 72px;
					height: 72px;
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
					.wsp-main {
						flex-direction: column;
					}
					.wsp-left {
						position: relative;
						top: 0;
						left: 0;
						width: 100%;
						height: auto;
						min-height: unset;
						padding: 40px 32px 36px;
						z-index: auto;
					}
					.wsp-left-headline {
						font-size: 26px;
					}
					.wsp-left-body {
						display: none;
					}
					.wsp-left-trust-list {
						flex-direction: row;
						flex-wrap: wrap;
						gap: 10px;
					}
					.wsp-left-bottom {
						display: none;
					}
					.wsp-right {
						margin-left: 0;
						padding: 36px 20px 60px;
					}
				}

				@media (max-width: 480px) {
					.wsp-left {
						padding: 32px 20px 28px;
					}
					.wsp-widget-card {
						padding: 20px;
						border-radius: 12px;
					}
				}
			`}</style>

			<div className="wsp-root">
				<main className="wsp-main">
					{/* ── Left branding panel (hidden if hideBrandPanel) ── */}
					{!hideBrandPanel && (
					<aside className="wsp-left">
						<div className="wsp-left-noise" aria-hidden />
						<div className="wsp-left-content">
							{/* Logo */}
							<div className="wsp-left-logo-wrap">
								{logo ? (
									<img
										src={logo}
										alt={companyName}
										className="wsp-left-logo-img"
									/>
								) : (
									<span className="wsp-left-logo-text">{companyName}</span>
								)}
							</div>

							{/* Eyebrow */}
							<p className="wsp-left-eyebrow">{companyName}</p>

							{/* Headline */}
							<h1 className="wsp-left-headline">
								{headline || widgetName || <>Fill out the form <em>& we'll be in touch</em></>}
							</h1>

							{/* Body copy */}
							<p className="wsp-left-body">
								{body || "Complete the form and our team will review your submission. We typically respond within one business day."}
							</p>

							{/* Trust signals */}
							<ul className="wsp-left-trust-list">
								{customTrustSignals ? (
									customTrustSignals.map((signal, i) => (
										<li key={i} className="wsp-left-trust-item">
											<span className="wsp-left-trust-icon">
												{signal.icon === "shield" && <Shield size={13} strokeWidth={2} />}
												{signal.icon === "clock" && <Clock size={13} strokeWidth={2} />}
												{signal.icon === "star" && <Star size={13} strokeWidth={2} />}
												{signal.icon === "check" && <Check size={13} strokeWidth={2} />}
												{signal.icon === "lock" && <Lock size={13} strokeWidth={2} />}
											</span>
											{signal.label}
										</li>
									))
								) : (
									<>
									<li className="wsp-left-trust-item">
										<span className="wsp-left-trust-icon">
											<Shield size={13} strokeWidth={2} />
										</span>
										Your data is secure
									</li>
									<li className="wsp-left-trust-item">
										<span className="wsp-left-trust-icon">
											<Clock size={13} strokeWidth={2} />
										</span>
										Replies within 24h
									</li>
									<li className="wsp-left-trust-item">
										<span className="wsp-left-trust-icon">
											<Star size={13} strokeWidth={2} />
										</span>
										No spam, ever
									</li>
									</>
								)}
							</ul>

							{/* Footer */}
							<div className="wsp-left-bottom">
								<div className="wsp-left-divider" />
								{footerLinks.length > 0 && (
									<nav className="wsp-left-footer-links">
										{footerLinks.map((link, i) => (
											<a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
												{link.label}
											</a>
										))}
									</nav>
								)}
								{showPoweredBy && (
									<Link to="/" style={{ textDecoration: "none" }}>
										<p className="wsp-left-powered">Powered by Financely</p>
									</Link>
								)}
							</div>
						</div>
					</aside>
					)}

					{/* ── Right widget panel ── */}
					<section className={hideBrandPanel ? "wsp-right wsp-right-full" : "wsp-right"}>
						<div className="wsp-right-inner">
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
										<button
											className="wsp-success-reset"
											onClick={onResetSubmit}
										>
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
									<div className="wsp-widget-card">
										{children}
									</div>
								</>
							)}
						</div>
					</section>
				</main>
			</div>
		</>
	);
}

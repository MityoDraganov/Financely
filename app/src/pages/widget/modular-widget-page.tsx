import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { LoadingScreen } from "@/components/loading-screen";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type { WidgetVersionActions } from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";
import { projectId } from "@/infrastructure/firebase";
import { functionsService } from "@/services/functions/functions-service";
import type { WidgetMultiStepOptions } from "@/core/entities/widget-version";
import { WidgetPage } from "@/core/entities/widget-block-schema";

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

type BrandingData = {
	logo: string | null;
	companyName: string;
	colors: Record<string, string>;
};

function NotPublishedPage({ branding }: { branding: BrandingData | null }) {
	const primary = branding?.colors?.primary ?? "#111827";
	const companyName = branding?.companyName ?? "This widget";
	const logo = branding?.logo;

	// Derive a very subtle tint for the background
	const hexToRgb = (hex: string) => {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16),
			  }
			: { r: 17, g: 24, b: 39 };
	};
	const rgb = hexToRgb(primary);

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

export default function ModularWidgetPage() {
	const { organizationId, widgetId } = useParams<{
		organizationId: string;
		widgetId: string;
	}>();
	const [config, setConfig] = useState<{
		branding: BrandingData;
		widget: {
			versionId: string;
			pages: WidgetPage[];
			actions: WidgetVersionActions;
			multiStepOptions?: WidgetMultiStepOptions;
		};
	} | null>(null);
	const [configError, setConfigError] = useState<string | null>(null);
	const [errorBranding, setErrorBranding] = useState<BrandingData | null>(null);
	const [submitStatus, setSubmitStatus] = useState<
		"idle" | "success" | "error"
	>("idle");
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
				const pages = Array.isArray(data.widget.pages)
					? data.widget.pages
					: [];
				const actions =
					data.widget.actions &&
					typeof data.widget.actions === "object"
						? (data.widget.actions as WidgetVersionActions)
						: { success: { message: "Thank you!" } };
				const multiStepOptions =
					data.widget.multiStepOptions &&
					typeof data.widget.multiStepOptions === "object"
						? data.widget.multiStepOptions
						: undefined;
				setConfig({
					branding: data.branding,
					widget: {
						versionId: data.widget.versionId,
						pages,
						actions,
						multiStepOptions,
					},
				});
			})
			.catch((err) => {
				const msg =
					err instanceof Error ? err.message : "Failed to load widget";
				setConfigError(msg);
				// If the error carries branding data (not published), extract it
				if (
					err &&
					typeof err === "object" &&
					"branding" in err &&
					(err as { branding?: unknown }).branding
				) {
					setErrorBranding(
						(err as { branding: BrandingData }).branding,
					);
				}
			});
	}, [organizationId, widgetId]);

	if (!organizationId || !widgetId) {
		return (
			<div className="min-h-screen w-screen max-w-none flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">
					Missing organization or widget
				</p>
			</div>
		);
	}

	if (configError) {
		// Show beautiful "not published" page for that specific error
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
				json.message ??
					config.widget.actions.success?.message ??
					"Thank you!",
			);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : "Something went wrong",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const colors = config.branding.colors ?? {};
	const themeStyling: Partial<WidgetStyling> = {
		primaryColor: colors.primary ?? defaultStyling.primaryColor,
		secondaryColor: colors.secondary ?? defaultStyling.secondaryColor,
		successColor: colors.accent ?? defaultStyling.successColor,
	};
	const primary = themeStyling.primaryColor ?? "#166534";
	const pageBg = `${primary}08`;

	if (submitStatus === "success") {
		return (
			<div
				className="min-h-screen w-screen max-w-none flex flex-col px-6 py-12 md:py-20"
				style={{
					backgroundColor: pageBg,
					fontFamily: defaultStyling.fontFamily,
					fontSize: defaultStyling.fontSize,
				}}
			>
				<div className="mx-auto flex flex-1 w-full max-w-2xl flex-col items-center justify-center text-center">
					<CheckCircle2
						className="h-14 w-14 mb-4"
						style={{ color: defaultStyling.successColor }}
					/>
					<h1
						className="font-serif text-2xl md:text-3xl font-semibold mb-2"
						style={{ color: defaultStyling.textColor }}
					>
						Thank you
					</h1>
					<p
						className="text-base max-w-md opacity-90"
						style={{ color: defaultStyling.textColor }}
					>
						{submitMessage}
					</p>
				</div>
				<footer className="mt-auto pt-12 pb-6 flex justify-center">
					<Link
						to="/"
						className="text-xs opacity-70"
						style={{ color: defaultStyling.textColor }}
					>
						Powered by Financely
					</Link>
				</footer>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen w-screen max-w-none flex flex-col items-center justify-center px-6 py-12 md:py-20"
			style={{
				backgroundColor: pageBg,
				fontFamily: defaultStyling.fontFamily,
				fontSize: defaultStyling.fontSize,
			}}
		>
			<div className="mx-auto w-full max-w-md">
				<div
					className="w-full rounded-xl shadow-lg overflow-hidden"
					style={{
						backgroundColor: defaultStyling.backgroundColor,
						border: `1px solid ${defaultStyling.borderColor}`,
						borderRadius: defaultStyling.borderRadius,
						boxShadow: defaultStyling.shadow,
						padding: "24px",
					}}
				>
					<WidgetSchemaRenderer
						pages={config.widget.pages}
						actions={config.widget.actions}
						styling={{ ...defaultStyling, ...themeStyling }}
						onSubmit={handleSubmit}
						submitting={submitting}
						submitError={submitError}
						multiStepOptions={config.widget.multiStepOptions}
					/>
				</div>
				<footer className="mt-8 flex justify-center">
					<Link
						to="/"
						className="text-xs opacity-70"
						style={{ color: defaultStyling.textColor }}
					>
						Powered by Financely
					</Link>
				</footer>
			</div>
		</div>
	);
}

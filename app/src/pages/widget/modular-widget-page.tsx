import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type { WidgetBlockSchema, WidgetVersionActions } from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";
import { projectId } from "@/infrastructure/firebase";
import { functionsService } from "@/services/functions/functions-service";

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

export default function ModularWidgetPage() {
	const { organizationId, widgetId } = useParams<{
		organizationId: string;
		widgetId: string;
	}>();
	const [config, setConfig] = useState<{
		branding: { logo: string | null; companyName: string; colors: Record<string, string> };
		widget: { versionId: string; schema: WidgetBlockSchema; actions: WidgetVersionActions };
	} | null>(null);
	const [configError, setConfigError] = useState<string | null>(null);
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
				const schema = Array.isArray(data.widget.schema) ? data.widget.schema : [];
				const actions = (data.widget.actions && typeof data.widget.actions === "object")
					? data.widget.actions as WidgetVersionActions
					: { success: { message: "Thank you!" } };
				setConfig({
					branding: data.branding,
					widget: {
						versionId: data.widget.versionId,
						schema,
						actions,
					},
				});
			})
			.catch((err) => {
				setConfigError(err instanceof Error ? err.message : "Failed to load widget");
			});
	}, [organizationId, widgetId]);

	if (!organizationId || !widgetId) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">Missing organization or widget</p>
			</div>
		);
	}

	if (configError) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">{configError}</p>
			</div>
		);
	}

	if (!config) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
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
			setSubmitMessage(json.message ?? config.widget.actions.success?.message ?? "Thank you!");
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "Something went wrong");
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
				className="min-h-screen flex flex-col px-6 py-12 md:py-20"
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
			className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 md:py-20"
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
						schema={config.widget.schema}
						actions={config.widget.actions}
						styling={{ ...defaultStyling, ...themeStyling }}
						onSubmit={handleSubmit}
						submitting={submitting}
						submitError={submitError}
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

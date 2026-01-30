import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { projectId } from "@/infrastructure/firebase";

const WIDGET_TYPE_MAP = {
	contact: "contactForm",
	invoice: "invoiceRequest",
	quote: "quoteRequest",
} as const;

type UrlWidgetType = keyof typeof WIDGET_TYPE_MAP;

interface WidgetConfig {
	enabled?: boolean;
	title?: string;
	description?: string;
	submitButtonText?: string;
	successMessage?: string;
	styling?: Record<string, string>;
	localization?: {
		defaultLanguage?: string;
		languages?: Record<string, Record<string, string>>;
	};
	builtInFields?: Record<
		string,
		{ enabled?: boolean; required?: boolean; label?: string }
	>;
	customFields?: Array<{
		id: string;
		name: string;
		label: string;
		type: string;
		required?: boolean;
		placeholder?: string;
		options?: string[];
		order?: number;
	}>;
}

interface WidgetConfigResponse {
	organizationId: string;
	branding: {
		logo?: string | null;
		companyName?: string;
		colors?: { primary?: string; secondary?: string; accent?: string };
	};
	widgets: {
		enabled: boolean;
		contactForm?: WidgetConfig | null;
		invoiceRequest?: WidgetConfig | null;
		quoteRequest?: WidgetConfig | null;
	};
}

function getTranslations(config: WidgetConfig | null): Record<string, string> {
	if (!config?.localization?.languages) return {};
	const lang =
		typeof navigator !== "undefined"
			? (navigator.language || "en").split("-")[0].toLowerCase()
			: "en";
	const langTranslations = config.localization.languages[lang];
	if (langTranslations) return langTranslations;
	return config.localization.languages.en ?? {};
}

function translate(
	key: string,
	translations: Record<string, string>,
	fallback: string
): string {
	return translations[key] ?? fallback;
}

export default function WidgetPage() {
	const { organizationId, widgetType } = useParams<{
		organizationId: string;
		widgetType: string;
	}>();
	const [config, setConfig] = useState<WidgetConfigResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
	const [submitMessage, setSubmitMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const urlType = (widgetType ?? "contact") as UrlWidgetType;
	const backendType =
		WIDGET_TYPE_MAP[urlType] ?? WIDGET_TYPE_MAP.contact;
	const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;

	useEffect(() => {
		if (!organizationId) {
			setError("Missing organization");
			return;
		}
		let cancelled = false;
		setError(null);
		fetch(`${apiUrl}/getWidgetConfig?organizationId=${encodeURIComponent(organizationId)}`)
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
				return res.json();
			})
			.then((data: WidgetConfigResponse) => {
				if (cancelled) return;
				setConfig(data);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to load widget");
			});
		return () => {
			cancelled = true;
		};
	}, [organizationId, apiUrl]);

	const rawWidget = config?.widgets?.enabled
		? (config.widgets[backendType] as WidgetConfig | null | undefined)
		: null;
	const widgetConfig = rawWidget?.enabled ? rawWidget : null;

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
				<p className="text-destructive">{error}</p>
			</div>
		);
	}

	if (!config || !widgetConfig?.enabled) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
				{!config ? (
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				) : (
					<p className="text-muted-foreground">Widget not available</p>
				)}
			</div>
		);
	}

	const styling = widgetConfig.styling ?? {};
	const defaultStyling = {
		primaryColor: config.branding?.colors?.primary ?? "#166534",
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
	const s = { ...defaultStyling, ...styling };
	const translations = getTranslations(widgetConfig);
	const title = translate(
		backendType === "contactForm" ? "contactUs" : backendType === "invoiceRequest" ? "requestInvoice" : "requestQuote",
		translations,
		widgetConfig.title ?? "Contact Us"
	);
	const description = translate("description", translations, widgetConfig.description ?? "");
	const submitLabel = translate("submitButton", translations, widgetConfig.submitButtonText ?? "Submit");
	const successMsg = translate("successMessage", translations, widgetConfig.successMessage ?? "Thank you!");

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!organizationId) return;
		setSubmitting(true);
		setSubmitStatus("idle");
		setSubmitMessage("");

		const form = e.currentTarget;
		const data: Record<string, string> = {};
		const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
			"input, textarea, select"
		);
		inputs.forEach((el) => {
			const name = el.name;
			if (!name) return;
			if (el instanceof HTMLInputElement && el.type === "checkbox") {
				data[name] = el.checked ? "true" : "false";
			} else {
				data[name] = el.value ?? "";
			}
		});

		try {
			const res = await fetch(`${apiUrl}/submitWidgetForm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					organizationId,
					widgetType: backendType,
					data,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error((json as { error?: string }).error ?? "Submit failed");
			}
			setSubmitStatus("success");
			setSubmitMessage(successMsg);
			form.reset();
		} catch (err) {
			setSubmitStatus("error");
			setSubmitMessage(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSubmitting(false);
		}
	};

	const builtInFields = widgetConfig.builtInFields ?? {};
	const customFields = widgetConfig.customFields ?? [];
	const fieldTypes: Record<string, string> = {
		name: "text",
		email: "email",
		phone: "tel",
		company: "text",
		message: "textarea",
	};

	const primary = config.branding?.colors?.primary ?? s.primaryColor ?? "#166534";
	// Page background: use custom pageBackgroundColor from widget styling if set (integrations page), else org primary tint
	const pageBg =
		(widgetConfig?.styling as Record<string, string> | undefined)?.pageBackgroundColor ??
		`${primary}08`;
	const organizationName = config.branding?.companyName ?? "Organization";
	const organizationLogo = config.branding?.logo ?? null;

	const footer = (
		<footer className="mt-auto pt-12 pb-6">
			<div
				className="flex items-center justify-center gap-2 text-xs"
				style={{ color: s.textColor, opacity: 0.7 }}
			>
				<span>Powered by</span>
				<Link
					to="/"
					className="font-medium transition-opacity hover:opacity-100"
					style={{ color: s.textColor }}
				>
					Financely
				</Link>
			</div>
		</footer>
	);

	// Full-page success state (v0-style)
	if (submitStatus === "success") {
		return (
			<div
				className="min-h-screen flex flex-col px-6 py-12 md:py-20"
				style={{
					backgroundColor: pageBg,
					fontFamily: s.fontFamily,
					fontSize: s.fontSize,
				}}
			>
				<div className="mx-auto flex flex-1 w-full max-w-2xl flex-col items-center justify-center text-center">
					{organizationLogo && (
						<img
							src={organizationLogo}
							alt={organizationName}
							className="h-12 w-auto object-contain mb-6"
						/>
					)}
					{!organizationLogo && (
						<p
							className="text-sm font-medium mb-6 opacity-70"
							style={{ color: s.textColor }}
						>
							{organizationName}
						</p>
					)}
					<CheckCircle2
						className="h-14 w-14 mb-4"
						style={{ color: s.successColor }}
					/>
					<h1
						className="font-serif text-2xl md:text-3xl font-semibold mb-2"
						style={{ color: s.textColor }}
					>
						Thank you
					</h1>
					<p
						className="text-base max-w-md opacity-90"
						style={{ color: s.textColor }}
					>
						{submitMessage}
					</p>
				</div>
				{footer}
			</div>
		);
	}

	return (
		<div
			className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 md:py-20"
			style={{
				backgroundColor: pageBg,
				fontFamily: s.fontFamily,
				fontSize: s.fontSize,
			}}
		>
			<div className="mx-auto flex w-full items-center justify-center max-w-2xl flex-col flex-1">
				{/* Header: organization + title */}
				<header className="mb-8 md:mb-10 flex flex-col items-center justify-center">
					{organizationLogo && (
						<img
							src={organizationLogo}
							alt={organizationName}
							className="h-10 w-auto object-contain mb-6"
						/>
					)}
					{!organizationLogo && (
						<p
							className="text-sm font-medium mb-4 opacity-70"
							style={{ color: s.textColor }}
						>
							{organizationName}
						</p>
					)}
					<h1
						className="font-serif text-2xl md:text-3xl font-semibold mb-2"
						style={{ color: s.textColor }}
					>
						{title}
					</h1>
					{description && (
						<p
							className="text-base opacity-80 max-w-xl"
							style={{ color: s.textColor }}
						>
							{description}
						</p>
					)}
				</header>

				{/* Form card */}
				<div
					className="w-full max-w-md rounded-xl shadow-lg overflow-hidden shrink-0"
					style={{
						backgroundColor: s.backgroundColor,
						border: `1px solid ${s.borderColor}`,
						borderRadius: s.borderRadius,
						boxShadow: s.shadow ?? "0 4px 12px rgba(0,0,0,0.15)",
					}}
				>
					<div className="p-6">
						<form onSubmit={handleSubmit} className="space-y-4">
							{backendType === "contactForm" &&
							(["name", "email", "phone", "company", "message"] as const).map(
								(key) => {
									const field = builtInFields[key];
									const enabled = field?.enabled ?? (key === "name" || key === "email");
									if (!enabled) return null;
									const label = translate(
										`${key}Label`,
										translations,
										field?.label ?? key
									);
									const type = fieldTypes[key] ?? "text";
									const required = field?.required ?? (key === "name" || key === "email");
									return (
										<div key={key}>
											<label
												className="block text-sm font-medium mb-1"
												style={{ color: s.textColor }}
											>
												{label}
												{required && (
													<span style={{ color: s.errorColor }}> *</span>
												)}
											</label>
											{type === "textarea" ? (
												<Textarea
													name={key}
													required={required}
													className="w-full resize-none"
													style={{
														borderColor: s.borderColor,
														borderRadius: s.borderRadius,
														color: s.textColor,
														backgroundColor: s.backgroundColor,
													}}
												/>
											) : (
												<Input
													name={key}
													type={type}
													required={required}
													className="w-full"
													style={{
														borderColor: s.borderColor,
														borderRadius: s.borderRadius,
														color: s.textColor,
														backgroundColor: s.backgroundColor,
													}}
												/>
											)}
										</div>
									);
								}
							)}

						{customFields
							.sort((a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0))
							.map((field: { id: string; name: string; label: string; type: string; required?: boolean; placeholder?: string; options?: string[]; order?: number }) => (
								<div key={field.id}>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: s.textColor }}
									>
										{translate(
											`${field.name}Label`,
											translations,
											field.label
										)}
										{field.required && (
											<span style={{ color: s.errorColor }}> *</span>
										)}
									</label>
									{field.type === "textarea" ? (
										<Textarea
											name={field.name}
											required={field.required}
											placeholder={field.placeholder}
											className="w-full resize-none"
											style={{
												borderColor: s.borderColor,
												borderRadius: s.borderRadius,
												color: s.textColor,
												backgroundColor: s.backgroundColor,
											}}
										/>
									) : field.type === "select" ? (
										<select
											name={field.name}
											required={field.required}
											className="w-full rounded-md border px-3 py-2 text-sm"
											style={{
												borderColor: s.borderColor,
												borderRadius: s.borderRadius,
												color: s.textColor,
												backgroundColor: s.backgroundColor,
											}}
										>
											<option value="">{field.placeholder ?? "Select..."}</option>
											{(field.options ?? []).map((opt: string) => (
												<option key={opt} value={opt}>
													{opt}
												</option>
											))}
										</select>
									) : (
										<Input
											name={field.name}
											type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
											required={field.required}
											placeholder={field.placeholder}
											className="w-full"
											style={{
												borderColor: s.borderColor,
												borderRadius: s.borderRadius,
												color: s.textColor,
												backgroundColor: s.backgroundColor,
											}}
										/>
									)}
								</div>
							))}

						{backendType !== "contactForm" && (
							<>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: s.textColor }}
									>
										{translate("name", translations, "Name")} *
									</label>
									<Input
										name="name"
										required
										className="w-full"
										style={{
											borderColor: s.borderColor,
											borderRadius: s.borderRadius,
											color: s.textColor,
											backgroundColor: s.backgroundColor,
										}}
									/>
								</div>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: s.textColor }}
									>
										{translate("email", translations, "Email")} *
									</label>
									<Input
										name="email"
										type="email"
										required
										className="w-full"
										style={{
											borderColor: s.borderColor,
											borderRadius: s.borderRadius,
											color: s.textColor,
											backgroundColor: s.backgroundColor,
										}}
									/>
								</div>
								<div>
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: s.textColor }}
									>
										{translate("message", translations, "Message")}
									</label>
									<Textarea
										name="message"
										className="w-full resize-none"
										style={{
											borderColor: s.borderColor,
											borderRadius: s.borderRadius,
											color: s.textColor,
											backgroundColor: s.backgroundColor,
										}}
									/>
								</div>
							</>
						)}

							{submitStatus === "error" && (
								<p
									className="text-sm py-2 px-3 rounded-md"
									style={{
										backgroundColor: `${s.errorColor}20`,
										color: s.errorColor,
										border: `1px solid ${s.errorColor}`,
									}}
								>
									{submitMessage}
								</p>
							)}

							<Button
								type="submit"
								disabled={submitting}
								className="w-full"
								style={{
									backgroundColor: s.primaryColor,
									color: s.backgroundColor,
									padding: s.buttonPadding,
									borderRadius: s.buttonBorderRadius,
								}}
							>
								{submitting ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Submitting...
									</>
								) : (
									submitLabel
								)}
							</Button>
						</form>
					</div>
				</div>

				{footer}
			</div>
		</div>
	);
}

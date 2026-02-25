import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
	Copy,
	Check,
	Link,
	Code,
	Frame,
	ExternalLink,
	ChevronDown,
	ChevronRight,
	Palette,
	Plus,
	Trash2,
	Shield,
	Clock,
	Star,
	CheckCircle,
	Lock,
	Loader2,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import type { WidgetPageConfig } from "@/core/entities/widget-definition";

interface ShareEmbedSectionProps {
	embedScript: string;
	organizationId: string;
	widgetDefinitions?: Array<{ id: string; name: string }>;
	selectedWidgetId?: string | null;
}

const TRUST_ICON_OPTIONS: Array<{ value: WidgetPageConfig["trustSignals"] extends Array<infer T> ? T["icon"] : never; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
	{ value: "shield", label: "Shield", Icon: Shield },
	{ value: "clock", label: "Clock", Icon: Clock },
	{ value: "star", label: "Star", Icon: Star },
	{ value: "check", label: "Check", Icon: CheckCircle },
	{ value: "lock", label: "Lock", Icon: Lock },
];

function TrustIcon({ icon, size = 14 }: { icon: string; size?: number }) {
	switch (icon) {
		case "shield": return <Shield size={size} strokeWidth={2} />;
		case "clock": return <Clock size={size} strokeWidth={2} />;
		case "star": return <Star size={size} strokeWidth={2} />;
		case "check": return <CheckCircle size={size} strokeWidth={2} />;
		case "lock": return <Lock size={size} strokeWidth={2} />;
		default: return <Shield size={size} strokeWidth={2} />;
	}
}

function PageCustomizationPanel() {
	const ctx = useWidgetBuilderContext();
	const [saving, setSaving] = useState(false);
	const [localConfig, setLocalConfig] = useState<WidgetPageConfig>(ctx?.pageConfig ?? {});

	const update = useCallback(<K extends keyof WidgetPageConfig>(key: K, value: WidgetPageConfig[K]) => {
		setLocalConfig((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleSave = async () => {
		if (!ctx) return;
		setSaving(true);
		try {
			await ctx.savePageConfig(localConfig);
		} finally {
			setSaving(false);
		}
	};

	const addTrustSignal = () => {
		const signals = [...(localConfig.trustSignals ?? [])];
		signals.push({ icon: "shield", label: "Your data is secure" });
		update("trustSignals", signals);
	};

	const removeTrustSignal = (index: number) => {
		const signals = [...(localConfig.trustSignals ?? [])];
		signals.splice(index, 1);
		update("trustSignals", signals);
	};

	const updateTrustSignal = (index: number, field: "icon" | "label", value: string) => {
		const signals = [...(localConfig.trustSignals ?? [])];
		signals[index] = { ...signals[index], [field]: value } as typeof signals[0];
		update("trustSignals", signals);
	};

	const addFooterLink = () => {
		const links = [...(localConfig.footerLinks ?? [])];
		links.push({ label: "Privacy Policy", url: "" });
		update("footerLinks", links);
	};

	const removeFooterLink = (index: number) => {
		const links = [...(localConfig.footerLinks ?? [])];
		links.splice(index, 1);
		update("footerLinks", links);
	};

	const updateFooterLink = (index: number, field: "label" | "url", value: string) => {
		const links = [...(localConfig.footerLinks ?? [])];
		links[index] = { ...links[index], [field]: value };
		update("footerLinks", links);
	};

	return (
		<div className="space-y-6">
			{/* Layout */}
			<div className="space-y-3">
				<h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Layout</h4>
				<div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
					<div>
						<p className="text-sm font-medium">Hide branding panel</p>
						<p className="text-xs text-muted-foreground">Show only the form, no left sidebar</p>
					</div>
					<Switch
						checked={localConfig.hideBrandPanel ?? false}
						onCheckedChange={(v) => update("hideBrandPanel", v)}
					/>
				</div>
			</div>

			{/* Brand panel content */}
			{!localConfig.hideBrandPanel && (
				<div className="space-y-3">
					<h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Left panel</h4>

					<div className="space-y-3 rounded-lg border border-border p-4">
						<div className="space-y-1.5">
							<Label className="text-xs">Headline</Label>
							<Input
								placeholder="Fill out the form & we'll be in touch"
								value={localConfig.headline ?? ""}
								onChange={(e) => update("headline", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Body copy</Label>
							<Textarea
								placeholder="Complete the form and our team will review your submission."
								value={localConfig.body ?? ""}
								onChange={(e) => update("body", e.target.value)}
								rows={2}
								className="resize-none"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs">Brand color override</Label>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={localConfig.primaryColor ?? "#2563eb"}
									onChange={(e) => update("primaryColor", e.target.value)}
									className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
								/>
								<Input
									value={localConfig.primaryColor ?? ""}
									onChange={(e) => update("primaryColor", e.target.value)}
									placeholder="#2563eb"
									className="font-mono text-xs"
								/>
							</div>
							<p className="text-[11px] text-muted-foreground">Leave blank to use your brand color</p>
						</div>

						{/* Trust signals */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">Trust signals</Label>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 text-xs gap-1"
									onClick={addTrustSignal}
								>
									<Plus size={12} />
									Add
								</Button>
							</div>
							{(localConfig.trustSignals ?? []).length === 0 && (
								<p className="text-xs text-muted-foreground italic">No trust signals — defaults will be shown</p>
							)}
							<div className="space-y-2">
								{(localConfig.trustSignals ?? []).map((signal, i) => (
									<div key={i} className="flex items-center gap-2">
										<select
											value={signal.icon}
											onChange={(e) => updateTrustSignal(i, "icon", e.target.value)}
											className="h-8 w-24 shrink-0 rounded-md border border-border bg-background px-2 text-xs"
										>
											{TRUST_ICON_OPTIONS.map((o) => (
												<option key={o.value} value={o.value}>{o.label}</option>
											))}
										</select>
										<Input
											value={signal.label}
											onChange={(e) => updateTrustSignal(i, "label", e.target.value)}
											placeholder="Label"
											className="text-xs h-8"
										/>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
											onClick={() => removeTrustSignal(i)}
										>
											<Trash2 size={13} />
										</Button>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Form area */}
			<div className="space-y-3">
				<h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Form area</h4>
				<div className="space-y-3 rounded-lg border border-border p-4">
					<div className="space-y-1.5">
						<Label className="text-xs">Form title</Label>
						<Input
							placeholder="Defaults to widget name"
							value={localConfig.formTitle ?? ""}
							onChange={(e) => update("formTitle", e.target.value)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label className="text-xs">Form subtitle</Label>
						<Input
							placeholder="Fill in the details below and we'll get back to you."
							value={localConfig.formSubtitle ?? ""}
							onChange={(e) => update("formSubtitle", e.target.value)}
						/>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="space-y-3">
				<h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Footer</h4>
				<div className="space-y-3 rounded-lg border border-border p-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Show "Powered by Financely"</p>
						</div>
						<Switch
							checked={localConfig.showPoweredBy !== false}
							onCheckedChange={(v) => update("showPoweredBy", v)}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs">Footer links</Label>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs gap-1"
								onClick={addFooterLink}
							>
								<Plus size={12} />
								Add
							</Button>
						</div>
						{(localConfig.footerLinks ?? []).length === 0 && (
							<p className="text-xs text-muted-foreground italic">No footer links added</p>
						)}
						<div className="space-y-2">
							{(localConfig.footerLinks ?? []).map((link, i) => (
								<div key={i} className="flex items-center gap-2">
									<Input
										value={link.label}
										onChange={(e) => updateFooterLink(i, "label", e.target.value)}
										placeholder="Label"
										className="text-xs h-8 w-28 shrink-0"
									/>
									<Input
										value={link.url}
										onChange={(e) => updateFooterLink(i, "url", e.target.value)}
										placeholder="https://..."
										className="text-xs h-8"
									/>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
										onClick={() => removeFooterLink(i)}
									>
										<Trash2 size={13} />
									</Button>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Save */}
			<Button onClick={handleSave} disabled={saving} className="w-full">
				{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
				Save page settings
			</Button>
		</div>
	);
}

export function ShareEmbedSection({
	embedScript,
	organizationId,
	widgetDefinitions = [],
	selectedWidgetId,
}: ShareEmbedSectionProps) {
	const { t } = useTranslation();
	const [copiedScript, setCopiedScript] = useState(false);
	const [copiedIframe, setCopiedIframe] = useState(false);
	const [copiedLink, setCopiedLink] = useState(false);
	const [expandedSection, setExpandedSection] = useState<string | null>("customize");

	const widgetIdForLink = selectedWidgetId ?? widgetDefinitions[0]?.id;
	const shareableLink = widgetIdForLink
		? `${window.location.origin}/widget/${organizationId}/modular/${widgetIdForLink}`
		: `${window.location.origin}/widget/${organizationId}`;
	const iframeSnippet = `<iframe 
  src="${shareableLink}"
  width="100%" 
  height="500"
  frameborder="0"
></iframe>`;

	const handleCopy = (text: string, type: "script" | "iframe" | "link") => {
		navigator.clipboard.writeText(text);
		if (type === "script") {
			setCopiedScript(true);
			setTimeout(() => setCopiedScript(false), 2000);
		} else if (type === "iframe") {
			setCopiedIframe(true);
			setTimeout(() => setCopiedIframe(false), 2000);
		} else {
			setCopiedLink(true);
			setTimeout(() => setCopiedLink(false), 2000);
		}
	};

	const toggleSection = (key: string) =>
		setExpandedSection((prev) => (prev === key ? null : key));

	return (
		<div className="space-y-4">
			{/* Shareable Link */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<div className="flex items-center justify-between p-4 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
							<Link className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<h3 className="text-sm font-medium text-foreground">
								{t("siteBuilder.embed.shareableLink", "Shareable Link")}
							</h3>
							<p className="text-xs text-muted-foreground">
								{t("siteBuilder.embed.shareableLinkDesc", "Direct link to your hosted widget page")}
							</p>
						</div>
					</div>
					<Button size="sm" onClick={() => handleCopy(shareableLink, "link")} className="gap-2">
						{copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
						{copiedLink ? t("common.copied", "Copied") : t("common.copyLink", "Copy Link")}
					</Button>
				</div>
				<div className="p-4 bg-muted/30">
					<div className="flex items-center gap-2">
						<code className="flex-1 rounded-md bg-background px-3 py-2 text-xs font-mono text-muted-foreground border border-border overflow-x-auto">
							{shareableLink}
						</code>
						<Button
							variant="outline"
							size="sm"
							className="shrink-0 bg-transparent"
							onClick={() => window.open(shareableLink, "_blank")}
						>
							<ExternalLink className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</div>

			{/* Page Customization */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<button
					onClick={() => toggleSection("customize")}
					className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
							<Palette className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="text-left">
							<h3 className="text-sm font-medium text-foreground">Page customization</h3>
							<p className="text-xs text-muted-foreground">
								Branding, copy, trust signals, and footer for your public page
							</p>
						</div>
					</div>
					{expandedSection === "customize" ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</button>
				{expandedSection === "customize" && (
					<div className="border-t border-border p-5">
						<PageCustomizationPanel />
					</div>
				)}
			</div>

			{/* Script Embed */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<button
					onClick={() => toggleSection("script")}
					className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
							<Code className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="text-left">
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-medium text-foreground">
									{t("siteBuilder.embed.scriptEmbed", "Script Embed")}
								</h3>
								<Badge variant="secondary" className="bg-primary/20 text-primary border-0 text-[10px]">
									{t("common.recommended", "Recommended")}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{t("siteBuilder.embed.scriptEmbedDesc", "Full functionality with automatic updates")}
							</p>
						</div>
					</div>
					{expandedSection === "script" ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</button>
				{expandedSection === "script" && (
					<div className="border-t border-border p-4">
						<div className="relative">
							<pre className="overflow-x-auto rounded-lg bg-background border border-border p-4 text-xs font-mono text-muted-foreground">
								{embedScript}
							</pre>
							<Button
								size="sm"
								variant="secondary"
								className="absolute top-2 right-2"
								onClick={() => handleCopy(embedScript, "script")}
							>
								{copiedScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* iFrame Embed */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<button
					onClick={() => toggleSection("iframe")}
					className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
				>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
							<Frame className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="text-left">
							<h3 className="text-sm font-medium text-foreground">
								{t("siteBuilder.embed.iframeEmbed", "iFrame Embed")}
							</h3>
							<p className="text-xs text-muted-foreground">
								{t("siteBuilder.embed.iframeEmbedDesc", "Simple embed for CSP-restricted sites")}
							</p>
						</div>
					</div>
					{expandedSection === "iframe" ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</button>
				{expandedSection === "iframe" && (
					<div className="border-t border-border p-4">
						<div className="relative">
							<pre className="overflow-x-auto rounded-lg bg-background border border-border p-4 text-xs font-mono text-muted-foreground">
								{iframeSnippet}
							</pre>
							<Button
								size="sm"
								variant="secondary"
								className="absolute top-2 right-2"
								onClick={() => handleCopy(iframeSnippet, "iframe")}
							>
								{copiedIframe ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							</Button>
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							{t("siteBuilder.embed.iframeNote", "Use iFrame if your platform blocks external scripts (Wix, some Squarespace themes).")}
						</p>
					</div>
				)}
			</div>

			{/* Platform Quick Guides */}
			<div className="space-y-3">
				<h3 className="text-sm font-medium text-foreground">
					{t("siteBuilder.embed.platformGuides", "Platform Guides")}
				</h3>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{["Webflow", "Wix", "Squarespace", "Framer"].map((platform) => (
						<button
							key={platform}
							className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
						>
							<span>{platform}</span>
							<ExternalLink className="h-3 w-3 ml-auto" />
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

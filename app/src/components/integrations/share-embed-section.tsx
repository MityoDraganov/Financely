import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Copy,
	Check,
	Link,
	Code,
	Frame,
	ExternalLink,
	ChevronDown,
	ChevronRight,
} from "lucide-react";
import { Badge } from "../ui/badge";

interface ShareEmbedSectionProps {
	embedScript: string;
	organizationId: string;
	widgetDefinitions?: Array<{ id: string; name: string }>;
	/** When set, share link/iframe target this widget; otherwise first definition or generic org link. */
	selectedWidgetId?: string | null;
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
	const [expandedSection, setExpandedSection] = useState<string | null>(
		"script"
	);

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

	return (
		<div className="space-y-6">
			{/* Shareable Link Card */}
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
								{t(
									"siteBuilder.embed.shareableLinkDesc",
									"Direct link to your hosted widget page"
								)}
							</p>
						</div>
					</div>
					<Button
						size="sm"
						onClick={() => handleCopy(shareableLink, "link")}
						className="gap-2"
					>
						{copiedLink ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<Copy className="h-3.5 w-3.5" />
						)}
						{copiedLink
							? t("common.copied", "Copied")
							: t("common.copyLink", "Copy Link")}
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

			{/* Script Embed Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<button
					onClick={() =>
						setExpandedSection(expandedSection === "script" ? null : "script")
					}
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
								<Badge
									variant="secondary"
									className="bg-primary/20 text-primary border-0 text-[10px]"
								>
									{t("common.recommended", "Recommended")}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{t(
									"siteBuilder.embed.scriptEmbedDesc",
									"Full functionality with automatic updates"
								)}
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
					<div className="border-t border-border">
						<div className="p-4 space-y-4">
							{/* Code block */}
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
									{copiedScript ? (
										<Check className="h-3.5 w-3.5" />
									) : (
										<Copy className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* iFrame Embed Card */}
			<div className="rounded-xl border border-border bg-card overflow-hidden">
				<button
					onClick={() =>
						setExpandedSection(expandedSection === "iframe" ? null : "iframe")
					}
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
								{t(
									"siteBuilder.embed.iframeEmbedDesc",
									"Simple embed for CSP-restricted sites"
								)}
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
								{copiedIframe ? (
									<Check className="h-3.5 w-3.5" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</Button>
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							{t(
								"siteBuilder.embed.iframeNote",
								"Use iFrame if your platform blocks external scripts (Wix, some Squarespace themes)."
							)}
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

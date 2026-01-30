import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
	Webhook,
	Zap,
	Table,
	ChevronDown,
	ChevronRight,
	Plus,
	ExternalLink,
	Play,
} from "lucide-react";

interface Integration {
	id: string;
	name: string;
	description: string;
	icon: React.ElementType;
	status: "connected" | "not_connected" | "needs_attention";
	lastSync?: string;
}

export function AutomationsSection() {
	const { t } = useTranslation();
	const [expandedSection, setExpandedSection] = useState<string | null>(
		"webhooks"
	);
	const [webhookUrl, setWebhookUrl] = useState("");

	const integrations: Integration[] = [
		{
			id: "webhooks",
			name: t("siteBuilder.automations.webhooks", "Webhooks"),
			description: t(
				"siteBuilder.automations.webhooksDesc",
				"Send form submissions to your server"
			),
			icon: Webhook,
			status: webhookUrl ? "connected" : "not_connected",
			lastSync: webhookUrl ? "2 min ago" : undefined,
		},
		{
			id: "zapier",
			name: "Zapier",
			description: t(
				"siteBuilder.automations.zapierDesc",
				"Connect to 5,000+ apps"
			),
			icon: Zap,
			status: "not_connected",
		},
		{
			id: "sheets",
			name: "Google Sheets",
			description: t(
				"siteBuilder.automations.sheetsDesc",
				"Sync submissions to a spreadsheet"
			),
			icon: Table,
			status: "not_connected",
		},
	];

	const StatusBadge = ({ status }: { status: Integration["status"] }) => {
		const config = {
			connected: {
				label: t("common.connected", "Connected"),
				className: "bg-primary/20 text-primary",
			},
			not_connected: {
				label: t("common.notConnected", "Not connected"),
				className: "bg-muted text-muted-foreground",
			},
			needs_attention: {
				label: t("common.needsAttention", "Needs attention"),
				className: "bg-destructive/20 text-destructive",
			},
		};
		return (
			<Badge
				variant="secondary"
				className={cn("text-[10px] border-0", config[status].className)}
			>
				{config[status].label}
			</Badge>
		);
	};

	return (
		<div className="space-y-6">
			{/* Integration Cards */}
			<div className="space-y-3">
				{integrations.map((integration) => (
					<div
						key={integration.id}
						className="rounded-xl border border-border bg-card overflow-hidden"
					>
						<button
							onClick={() =>
								setExpandedSection(
									expandedSection === integration.id ? null : integration.id
								)
							}
							className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
						>
							<div className="flex items-center gap-3">
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-lg",
										integration.status === "connected"
											? "bg-muted"
											: "bg-muted/50"
									)}
								>
									<integration.icon
										className={cn(
											"h-5 w-5",
											integration.status === "connected"
												? "text-foreground"
												: "text-muted-foreground"
										)}
									/>
								</div>
								<div className="text-left">
									<div className="flex items-center gap-2">
										<h3 className="text-sm font-medium text-foreground">
											{integration.name}
										</h3>
										<StatusBadge status={integration.status} />
									</div>
									<p className="text-xs text-muted-foreground">
										{integration.description}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								{integration.lastSync && (
									<span className="text-xs text-muted-foreground">
										{t("siteBuilder.automations.lastSync", "Last sync")}:{" "}
										{integration.lastSync}
									</span>
								)}
								{expandedSection === integration.id ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
							</div>
						</button>

						{/* Webhook Expanded */}
						{expandedSection === "webhooks" &&
							integration.id === "webhooks" && (
								<div className="border-t border-border p-4 space-y-4">
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-muted-foreground">
											{t("siteBuilder.automations.endpointUrl", "Endpoint URL")}
										</label>
										<Input
											value={webhookUrl}
											onChange={(e) => setWebhookUrl(e.target.value)}
											className="bg-background font-mono text-sm"
											placeholder="https://your-api.com/webhooks"
										/>
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-muted-foreground">
												{t("siteBuilder.automations.eventTypes", "Event Types")}
											</label>
											<select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
												<option>widget.submitted</option>
												<option>widget.started</option>
												<option>
													{t("siteBuilder.automations.allEvents", "All events")}
												</option>
											</select>
										</div>
										<div className="space-y-1.5">
											<label className="text-xs font-medium text-muted-foreground">
												{t("siteBuilder.automations.retries", "Retries")}
											</label>
											<select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
												<option>
													3{" "}
													{t("siteBuilder.automations.retriesDefault", "retries (Default)")}
												</option>
												<option>5 {t("siteBuilder.automations.retriesCount", "retries")}</option>
												<option>
													{t("siteBuilder.automations.noRetries", "No retries")}
												</option>
											</select>
										</div>
									</div>

									<div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
										<div>
											<p className="text-sm font-medium text-foreground">
												{t(
													"siteBuilder.automations.signatureVerification",
													"Signature verification"
												)}
											</p>
											<p className="text-xs text-muted-foreground">
												{t(
													"siteBuilder.automations.signatureVerificationDesc",
													"Secure webhook with HMAC signature"
												)}
											</p>
										</div>
										<Switch />
									</div>

									{/* Payload Preview */}
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<label className="text-xs font-medium text-muted-foreground">
												{t(
													"siteBuilder.automations.examplePayload",
													"Example Payload"
												)}
											</label>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 text-xs text-muted-foreground"
											>
												{t("common.copy", "Copy")}
											</Button>
										</div>
										<pre className="overflow-x-auto rounded-lg bg-background border border-border p-3 text-xs font-mono text-muted-foreground">
											{`{
  "event": "widget.submitted",
  "timestamp": "${new Date().toISOString()}",
  "data": {
    "widget_type": "contact_form",
    "fields": {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello!"
    }
  }
}`}
										</pre>
									</div>

									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											className="gap-2 bg-transparent"
										>
											<Play className="h-3.5 w-3.5" />
											{t(
												"siteBuilder.automations.sendTestEvent",
												"Send Test Event"
											)}
										</Button>
									</div>
								</div>
							)}

						{/* Zapier Expanded */}
						{expandedSection === "zapier" && integration.id === "zapier" && (
							<div className="border-t border-border p-4 space-y-4">
								<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
										<Zap className="h-5 w-5 text-muted-foreground" />
									</div>
									<h4 className="text-sm font-medium text-foreground mb-1">
										{t("siteBuilder.automations.connectZapier", "Connect Zapier")}
									</h4>
									<p className="text-xs text-muted-foreground mb-4 max-w-xs">
										{t(
											"siteBuilder.automations.connectZapierDesc",
											"Automate your workflow by connecting form submissions to 5,000+ apps"
										)}
									</p>
									<Button size="sm" className="gap-2">
										<ExternalLink className="h-3.5 w-3.5" />
										{t("siteBuilder.automations.connectAccount", "Connect Account")}
									</Button>
								</div>
							</div>
						)}

						{/* Google Sheets Expanded */}
						{expandedSection === "sheets" && integration.id === "sheets" && (
							<div className="border-t border-border p-4 space-y-4">
								<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
										<Table className="h-5 w-5 text-muted-foreground" />
									</div>
									<h4 className="text-sm font-medium text-foreground mb-1">
										{t(
											"siteBuilder.automations.connectSheets",
											"Connect Google Sheets"
										)}
									</h4>
									<p className="text-xs text-muted-foreground mb-4 max-w-xs">
										{t(
											"siteBuilder.automations.connectSheetsDesc",
											"Automatically sync every form submission to a Google Spreadsheet"
										)}
									</p>
									<Button size="sm" className="gap-2">
										<Plus className="h-3.5 w-3.5" />
										{t(
											"siteBuilder.automations.connectGoogleAccount",
											"Connect Google Account"
										)}
									</Button>
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{/* Coming Soon Integrations */}
			<div className="space-y-3">
				<h3 className="text-sm font-medium text-foreground">
					{t("siteBuilder.automations.moreIntegrations", "More Integrations")}
				</h3>
				<div className="grid gap-3 sm:grid-cols-3">
					{[
						{
							name: "Slack",
							description: t(
								"siteBuilder.automations.slackDesc",
								"Get notified in Slack"
							),
						},
						{
							name: "HubSpot",
							description: t(
								"siteBuilder.automations.hubspotDesc",
								"Create CRM contacts"
							),
						},
						{
							name: "Airtable",
							description: t(
								"siteBuilder.automations.airtableDesc",
								"Sync to Airtable base"
							),
						},
					].map((item) => (
						<button
							key={item.name}
							className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left hover:border-muted-foreground/50 transition-colors"
						>
							<span className="text-sm font-medium text-foreground">
								{item.name}
							</span>
							<span className="text-xs text-muted-foreground">
								{item.description}
							</span>
							<Badge
								variant="secondary"
								className="mt-2 text-[10px] bg-muted text-muted-foreground border-0"
							>
								{t("common.comingSoon", "Coming Soon")}
							</Badge>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

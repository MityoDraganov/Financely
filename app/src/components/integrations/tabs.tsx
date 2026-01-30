import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Code2, Palette, Zap } from "lucide-react";

export type TabValue = "share" | "design" | "automations";

interface IntegrationsTabsProps {
	activeTab: TabValue;
	onTabChange: (tab: TabValue) => void;
}

export function IntegrationsTabs({
	activeTab,
	onTabChange,
}: IntegrationsTabsProps) {
	const { t } = useTranslation();

	const tabs = [
		{
			value: "design" as const,
			label: t("siteBuilder.tabs.design", "Design"),
			icon: Palette,
		},
		{
			value: "share" as const,
			label: t("siteBuilder.tabs.shareEmbed", "Share & Embed"),
			icon: Code2,
		},
		{
			value: "automations" as const,
			label: t("siteBuilder.tabs.automations", "Automations"),
			icon: Zap,
		},
	];

	return (
		<nav className="flex items-center gap-1" role="tablist">
			{tabs.map((tab) => (
				<button
					key={tab.value}
					role="tab"
					aria-selected={activeTab === tab.value}
					onClick={() => onTabChange(tab.value)}
					className={cn(
						"relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
						"hover:text-foreground",
						activeTab === tab.value
							? "text-foreground"
							: "text-muted-foreground"
					)}
				>
					<tab.icon className="h-4 w-4" />
					{tab.label}
					{activeTab === tab.value && (
						<span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
					)}
				</button>
			))}
		</nav>
	);
}

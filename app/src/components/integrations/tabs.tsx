import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Code2, Palette, Zap, Lock, Blocks } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export type TabValue = "share" | "design" | "pageBuilder" | "automations";

interface IntegrationsTabsProps {
	activeTab: TabValue;
	onTabChange: (tab: TabValue) => void;
	hasWidgetSelected?: boolean;
}

export function IntegrationsTabs({
	activeTab,
	onTabChange,
	hasWidgetSelected = false,
}: IntegrationsTabsProps) {
	const { t } = useTranslation();

	const tabs = [
		{
			value: "design" as const,
			label: t("siteBuilder.tabs.design", "Design"),
			icon: Palette,
			requiresWidget: false,
		},
		{
			value: "share" as const,
			label: t("siteBuilder.tabs.shareEmbed", "Share & Embed"),
			icon: Code2,
			requiresWidget: true,
		},
		{
			value: "pageBuilder" as const,
			label: "Page Builder",
			icon: Blocks,
			requiresWidget: true,
		},
		{
			value: "automations" as const,
			label: t("siteBuilder.tabs.automations", "Automations"),
			icon: Zap,
			requiresWidget: true,
		},
	];

	return (
		<nav className="flex items-center gap-1" role="tablist">
			{tabs.map((tab) => {
				const isLocked = tab.requiresWidget && !hasWidgetSelected;
				const isActive = activeTab === tab.value;

				const button = (
					<button
						key={tab.value}
						role="tab"
						aria-selected={isActive}
						disabled={isLocked}
						onClick={() => !isLocked && onTabChange(tab.value)}
						className={cn(
							"relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
							isLocked
								? "cursor-not-allowed text-muted-foreground/40"
								: isActive
									? "text-foreground hover:text-foreground"
									: "text-muted-foreground hover:text-foreground",
						)}
					>
						<tab.icon className="h-4 w-4" />
						{tab.label}
						{isLocked && (
							<Lock className="h-3 w-3 opacity-50" />
						)}
						{isActive && !isLocked && (
							<span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
						)}
					</button>
				);

				if (isLocked) {
					return (
						<Tooltip key={tab.value}>
							<TooltipTrigger asChild>{button}</TooltipTrigger>
							<TooltipContent>
								{t(
									"siteBuilder.tabs.requiresWidget",
									"Select a widget first",
								)}
							</TooltipContent>
						</Tooltip>
					);
				}

				return button;
			})}
		</nav>
	);
}

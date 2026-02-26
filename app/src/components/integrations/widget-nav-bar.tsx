import { useTranslation } from "react-i18next";
import { IntegrationsTabs, type TabValue } from "./tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface WidgetDefinitionOption {
	id: string;
	name: string;
}

interface IntegrationsWidgetNavBarProps {
	activeTab: TabValue;
	onTabChange: (tab: TabValue) => void;
	hasWidgetSelected: boolean;
	selectedWidgetId: string;
	onWidgetChange: (widgetId: string) => void;
	widgetDefinitions: WidgetDefinitionOption[];
	loadingDefinitions?: boolean;
}

export function IntegrationsWidgetNavBar({
	activeTab,
	onTabChange,
	hasWidgetSelected,
	selectedWidgetId,
	onWidgetChange,
	widgetDefinitions,
	loadingDefinitions = false,
}: IntegrationsWidgetNavBarProps) {
	const { t } = useTranslation();

	return (
		<div className="border-b border-border shrink-0">
			<div className="w-full p-2">
				<div
					className="flex flex-row items-center gap-1 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_240px] lg:gap-0"
				>
					<div className="w-[180px] shrink-0 sm:w-[220px] lg:w-auto">
						<Select
							value={selectedWidgetId}
							onValueChange={onWidgetChange}
							disabled={loadingDefinitions || widgetDefinitions.length === 0}
						>
							<SelectTrigger className="w-full h-9">
								<SelectValue
									placeholder={t(
										"siteBuilder.widgets.selectWidget",
										"Select widget",
									)}
								/>
							</SelectTrigger>
							<SelectContent>
								{widgetDefinitions.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										{d.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="min-w-0 flex-1 overflow-x-auto lg:flex lg:justify-center lg:overflow-visible">
						<IntegrationsTabs
							activeTab={activeTab}
							onTabChange={onTabChange}
							hasWidgetSelected={hasWidgetSelected}
						/>
					</div>
					<div className="hidden lg:block" aria-hidden="true" />
				</div>
			</div>
		</div>
	);
}

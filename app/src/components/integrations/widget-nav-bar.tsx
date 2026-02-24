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
				<div className="flex flex-col gap-2 md:relative md:min-h-10 md:flex-row md:items-center">
					<div className="md:relative md:z-10 md:w-[240px]">
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
					<div className="self-center md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
						<IntegrationsTabs
							activeTab={activeTab}
							onTabChange={onTabChange}
							hasWidgetSelected={hasWidgetSelected}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

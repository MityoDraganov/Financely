import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const DOCS_INTEGRATIONS_URL = "https://docs.financely.app/user-manual/integrations/widget-embed";

export function IntegrationsHeader() {
	const { t } = useTranslation();

	return (
		<header className="border-b border-border">
			<div className="w-full flex items-start justify-between gap-4 px-6 py-6">
				<div className="space-y-1.5">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">
							{t("siteBuilder.sidebar.integrationWidgets")}
						</h1>
					</div>
		
				</div>

				<div className="flex items-center gap-4 shrink-0">
					<Button
						variant="outline"
						size="sm"
						className="text-muted-foreground bg-transparent"
						asChild
					>
						<a
							href={DOCS_INTEGRATIONS_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLink className="mr-2 h-3.5 w-3.5" />
							{t("common.viewDocs", "View Docs")}
						</a>
					</Button>
				</div>
			</div>
		</header>
	);
}

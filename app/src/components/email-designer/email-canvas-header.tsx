import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { EmailTemplate } from "@/core";
import { EnhancedPresenceIndicator } from "@/components/designer/enhanced-presence-indicator";
import type { UserPresence } from "@/services/presence/presence-service";

type EmailCanvasHeaderProps = {
	templates: EmailTemplate[];
	currentTemplate: EmailTemplate | undefined;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void;
	isMobile?: boolean;
	isLive?: boolean;
	activeUsers?: UserPresence[];
};

export function EmailCanvasHeader({
	templates,
	currentTemplate,
	onTemplateChange,
	onCreateNewTemplate,
	isMobile = false,
	isLive = false,
	activeUsers = [],
}: EmailCanvasHeaderProps) {
	const { t } = useTranslation();
	
	const handleTemplateChange = (id: string) => {
		if (id === "new") {
			onCreateNewTemplate();
		} else {
			onTemplateChange(id);
		}
	};

	return (
		<div className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0">
			{/* Template selector - hidden on mobile (shown in layout header) */}
			{!isMobile && (
				<Select
					value={currentTemplate?.id ?? ""}
					onValueChange={handleTemplateChange}
				>
					<SelectTrigger className="w-60">
						<SelectValue placeholder={t('emailDesigner.canvasHeader.selectTemplate')} />
					</SelectTrigger>
					<SelectContent>
						{templates.map((t: EmailTemplate) => (
							<SelectItem key={t.id} value={t.id}>
								{t.name}
							</SelectItem>
						))}
						<SelectItem value="new">
							<Plus className="h-4 w-4 mr-1" /> {t('emailDesigner.canvasHeader.newTemplate')}
						</SelectItem>
					</SelectContent>
				</Select>
			)}
			{!isMobile && isLive && (
				<div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded shrink-0">
					<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
					<span>{t("emailDesigner.canvasHeader.live")}</span>
				</div>
			)}
			{!isMobile && activeUsers.length > 0 && (
				<EnhancedPresenceIndicator users={activeUsers} />
			)}
		</div>
	);
}


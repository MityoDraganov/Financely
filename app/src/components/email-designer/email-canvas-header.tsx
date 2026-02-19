import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
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
	hasChanges?: boolean;
	isSaving?: boolean;
};

export function EmailCanvasHeader({
	templates,
	currentTemplate,
	onTemplateChange,
	onCreateNewTemplate,
	isMobile = false,
	isLive = false,
	activeUsers = [],
	hasChanges = false,
	isSaving = false,
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
		<div className="border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
			<div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
				<div className="flex min-w-0 items-center gap-2">
					{isMobile && currentTemplate && (
						<p className="text-sm font-semibold text-foreground truncate max-w-[52vw]">
							{currentTemplate.name}
						</p>
					)}
					{/* Template selector - hidden on mobile (shown in layout header) */}
					{!isMobile && (
						<Select
							value={currentTemplate?.id ?? ""}
							onValueChange={handleTemplateChange}
						>
							<SelectTrigger className="w-72 bg-background">
								<SelectValue placeholder={t("emailDesigner.canvasHeader.selectTemplate")} />
							</SelectTrigger>
							<SelectContent>
								{templates.map((t: EmailTemplate) => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
								<SelectItem value="new">
									<Plus className="h-4 w-4 mr-1" /> {t("emailDesigner.canvasHeader.newTemplate")}
								</SelectItem>
							</SelectContent>
						</Select>
					)}
				</div>
				<div className="flex items-center gap-2 ml-auto">
					<div
						className={[
							"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
							isSaving
								? "border-blue-200 text-blue-700 bg-blue-50"
								: hasChanges
									? "border-amber-200 text-amber-700 bg-amber-50"
									: "border-emerald-200 text-emerald-700 bg-emerald-50",
						].join(" ")}
					>
						{isSaving ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : !hasChanges ? (
							<CheckCircle2 className="h-3.5 w-3.5" />
						) : null}
						<span>{isSaving ? "Saving" : hasChanges ? "Unsaved changes" : "Saved"}</span>
					</div>
					{isLive && (
						<div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
							<div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
							<span>{t("emailDesigner.canvasHeader.live")}</span>
						</div>
					)}
					{activeUsers.length > 0 && <EnhancedPresenceIndicator users={activeUsers} />}
				</div>
			</div>
		</div>
	);
}

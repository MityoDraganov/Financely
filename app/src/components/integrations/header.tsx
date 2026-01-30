import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Sparkles,
	ExternalLink,
	Plus,
	FileText,
	MessageSquare,
	Receipt,
} from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { WIDGET_TEMPLATES } from "@/core/widget-templates";

function widgetStatusLabel(status: string): string {
	return status === "published" ? "Active" : "Draft";
}

export function IntegrationsHeader() {
	const { t } = useTranslation();
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const ctx = useWidgetDesigner();
	const definitions = ctx?.definitions ?? [];
	const currentWidgetId = ctx?.currentWidgetId;
	const onWidgetChange = ctx?.onWidgetChange ?? (() => {});
	const onCreateNewWidget = ctx?.onCreateNewWidget ?? (() => {});
	const onCreateFromTemplate = ctx?.onCreateFromTemplate ?? (async () => {});

	const handleCreateFromTemplate = async (
		template: (typeof WIDGET_TEMPLATES)[number],
	) => {
		await onCreateFromTemplate({
			id: template.id,
			name: template.name,
			schema: template.schema,
			actions: template.actions,
		});
		setTemplateDialogOpen(false);
	};

	return (
		<header className="border-b border-border">
			<div className="w-full flex gap-7 px-6 py-6">
				{ctx && (
					<div className="flex flex-col items-center gap-4">
						<div className="flex items-center gap-4">
							<Button
								size="sm"
								onClick={() => void onCreateNewWidget()}
							>
								<Plus className="h-4 w-4 mr-1" />
								{t("siteBuilder.widgets.new", "New")}
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setTemplateDialogOpen(true)}
							>
								{t("siteBuilder.widgets.template", "Template")}
							</Button>
						</div>
						<Select
							value={currentWidgetId ?? ""}
							onValueChange={(id) => id && onWidgetChange(id)}
						>
							<SelectTrigger className="w-[200px]">
								<SelectValue
									placeholder={t(
										"siteBuilder.widgets.selectWidget",
										"Select widget",
									)}
								/>
							</SelectTrigger>
							<SelectContent>
								{definitions.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										<span className="truncate block">
											{d.name}
										</span>
										<span className="text-xs text-muted-foreground ml-1">
											({widgetStatusLabel(d.status)})
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<div className="flex w-full items-start justify-between gap-4">
					<div className="flex items-center gap-4 flex-wrap">
						<div className="space-y-2">
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-semibold tracking-tight text-foreground">
									{t(
										"siteBuilder.sidebar.integrationWidgets",
									)}
								</h1>
								<Badge
									variant="secondary"
									className="bg-primary/10 text-primary border-0 text-xs font-medium"
								>
									<Sparkles className="mr-1 h-3 w-3" />
									{t("siteBuilder.aiWidgetDialog.title")}
								</Badge>
							</div>
							<p className="text-sm text-muted-foreground max-w-xl">
								{t("siteBuilder.subtitle")}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-4 flex-wrap">
						<Button
							variant="outline"
							size="sm"
							className="text-muted-foreground bg-transparent"
						>
							<ExternalLink className="mr-2 h-3.5 w-3.5" />
							{t("common.viewDocs", "View Docs")}
						</Button>
					</div>
				</div>
				<Dialog
					open={templateDialogOpen}
					onOpenChange={setTemplateDialogOpen}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{t(
									"siteBuilder.widgets.createFromTemplate",
									"Create from template",
								)}
							</DialogTitle>
						</DialogHeader>
						<div className="grid gap-2 py-2">
							{WIDGET_TEMPLATES.map((tpl) => (
								<Button
									key={tpl.id}
									variant="outline"
									className="justify-start h-auto py-3"
									onClick={() =>
										void handleCreateFromTemplate(tpl)
									}
								>
									{tpl.id === "contact" && (
										<MessageSquare className="h-4 w-4 mr-2" />
									)}
									{tpl.id === "quote" && (
										<FileText className="h-4 w-4 mr-2" />
									)}
									{tpl.id === "invoice" && (
										<Receipt className="h-4 w-4 mr-2" />
									)}
									{tpl.name}
								</Button>
							))}
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</header>
	);
}

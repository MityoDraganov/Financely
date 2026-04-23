import { useTranslation } from "react-i18next";
import { Plus, Info, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
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
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Template } from "@/core";
import { EnhancedPresenceIndicator } from "./enhanced-presence-indicator";
import type { DesignerState } from "./designer-types";
import type { UserPresence } from "@/services/presence/presence-service";
import { Button } from "@/components/ui/button";

type CanvasHeaderProps = {
	templates: Template[];
	currentTemplate: Template | undefined;
	state: DesignerState;
	isSubscribed: boolean;
	activeUsers: UserPresence[];
	designerMode?: "content" | "background";
	onDesignerModeChange?: (mode: "content" | "background") => void;
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void;
	onZoomChange: (zoom: number) => void;
	onTogglePreview?: () => void;
	isMobile?: boolean;
};

export function CanvasHeader({
	templates,
	currentTemplate,
	state,
	isSubscribed,
	activeUsers,
	designerMode = "content",
	onDesignerModeChange,
	onTemplateChange,
	onZoomChange,
	onTogglePreview,
	isMobile = false,
}: CanvasHeaderProps) {
	const { t } = useTranslation();
	const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

	return (
		<div className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0">
			{/* Template selector - hidden on mobile (shown in layout header) */}
			{!isMobile && (
				<Select
					value={currentTemplate?.id ?? ""}
					onValueChange={onTemplateChange}
				>
					<SelectTrigger className="w-60">
						<SelectValue placeholder={t('designer.canvasHeader.selectTemplate')} />
					</SelectTrigger>
					<SelectContent>
						{templates.map((t: Template) => (
							<SelectItem key={t.id} value={t.id}>
								{t.name}
							</SelectItem>
						))}
						<SelectItem value="new">
							<Plus className="h-4 w-4 mr-1" /> {t('designer.canvasHeader.newTemplate')}
						</SelectItem>
					</SelectContent>
				</Select>
			)}
			{!isMobile && isSubscribed && (
				<div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded shrink-0 border border-green-200 dark:border-green-800">
					<div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
					<span>{t('designer.canvasHeader.live')}</span>
				</div>
			)}
			{!isMobile && onDesignerModeChange && (
				<div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
					<button
						type="button"
						onClick={() => onDesignerModeChange("content")}
						className={`px-3 py-1 text-xs font-medium transition-colors ${
							designerMode === "content"
								? "bg-primary text-primary-foreground"
								: "bg-transparent text-muted-foreground hover:bg-muted"
						}`}
					>
						{t('designer.canvasHeader.contentLayer', 'Content')}
					</button>
					<button
						type="button"
						onClick={() => onDesignerModeChange("background")}
						className={`px-3 py-1 text-xs font-medium transition-colors ${
							designerMode === "background"
								? "bg-primary text-primary-foreground"
								: "bg-transparent text-muted-foreground hover:bg-muted"
						}`}
					>
						{t('designer.canvasHeader.backgroundLayer', 'Background')}
					</button>
				</div>
			)}
			{designerMode === "background" && !isMobile && (
				<span className="text-xs text-muted-foreground shrink-0">
					{t('designer.canvasHeader.backgroundHint', 'Repeats on every page')}
				</span>
			)}
			{!isMobile && <EnhancedPresenceIndicator users={activeUsers} />}
			<div className="ml-auto flex items-center gap-2 shrink-0">
				{onTogglePreview && (
					<Button
						variant={state.previewMode ? "secondary" : "ghost"}
						size="sm"
						className="h-8 gap-1.5 text-xs"
						onClick={onTogglePreview}
						title={state.previewMode ? t('designer.canvasHeader.exitPreview', 'Exit Preview') : t('designer.canvasHeader.preview', 'Preview')}
					>
						{state.previewMode ? (
							<EyeOff className="h-3.5 w-3.5" />
						) : (
							<Eye className="h-3.5 w-3.5" />
						)}
						{!isMobile && (state.previewMode ? t('designer.canvasHeader.exitPreview', 'Exit Preview') : t('designer.canvasHeader.preview', 'Preview'))}
					</Button>
				)}
				{!isMobile && (
					<Select
						value={String(state.zoom)}
						onValueChange={(v: string) => onZoomChange(Number(v))}
					>
						<SelectTrigger className="w-24">
							<SelectValue placeholder={t('designer.canvasHeader.zoom')} />
						</SelectTrigger>
						<SelectContent>
							{[0.75, 1, 1.25, 1.5, 2].map((z) => (
								<SelectItem key={z} value={String(z)}>
									{Math.round(z * 100)}%
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				<Dialog open={cheatSheetOpen} onOpenChange={setCheatSheetOpen}>
					<DialogTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<Info className="h-4 w-4" />
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>{t('designer.cheatSheet.title', 'Keyboard Shortcuts')}</DialogTitle>
							<DialogDescription>
								{t('designer.cheatSheet.description', 'Quick reference for all keyboard shortcuts')}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-6 mt-4">
							{/* Navigation & Selection */}
							<div>
								<h3 className="font-semibold text-sm mb-3 text-foreground">
									{t('designer.cheatSheet.navigation', 'Navigation & Selection')}
								</h3>
								<div className="space-y-2">
									<ShortcutRow
										keys={['Esc']}
										description={t('designer.cheatSheet.deselect', 'Deselect all elements')}
									/>
								</div>
							</div>

							{/* Movement */}
							<div>
								<h3 className="font-semibold text-sm mb-3 text-foreground">
									{t('designer.cheatSheet.movement', 'Movement')}
								</h3>
								<div className="space-y-2">
									<ShortcutRow
										keys={['↑', '↓', '←', '→']}
										description={t('designer.cheatSheet.nudge', 'Nudge selected element by 1px')}
									/>
									<ShortcutRow
										keys={['Shift', '+', '↑', '↓', '←', '→']}
										description={t('designer.cheatSheet.nudgeLarge', 'Nudge selected element by 10px')}
									/>
									<ShortcutRow
										keys={['Alt', '+', '↑', '↓', '←', '→']}
										description={t('designer.cheatSheet.nudgeSmall', 'Nudge selected element by 0.5px')}
									/>
								</div>
							</div>

							{/* Context Menu Actions */}
							<div>
								<h3 className="font-semibold text-sm mb-3 text-foreground">
									{t('designer.cheatSheet.contextActions', 'Context Menu Actions')}
								</h3>
								<div className="space-y-2">
									<ShortcutRow
										keys={['Right Click']}
										description={t('designer.cheatSheet.contextMenu', 'Open context menu (Duplicate, Delete, etc.)')}
									/>
								</div>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
	return (
		<div className="flex items-center justify-between py-1.5">
			<span className="text-sm text-muted-foreground">{description}</span>
			<div className="flex items-center gap-1">
				{keys.map((key, index) => (
					<span key={index} className="flex items-center gap-1">
						{index > 0 && key !== '+' && <span className="text-muted-foreground text-xs">+</span>}
						{key !== '+' && (
							<kbd className="px-2 py-1 bg-muted rounded text-xs font-mono min-w-[28px] text-center">
								{key}
							</kbd>
						)}
					</span>
				))}
			</div>
		</div>
	);
}

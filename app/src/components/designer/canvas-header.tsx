import { Plus } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Template } from "@/core";
import { EnhancedPresenceIndicator } from "./enhanced-presence-indicator";
import type { DesignerState } from "./designer-types";
import type { UserPresence } from "@/services/presence/presence-service";

type CanvasHeaderProps = {
	templates: Template[];
	currentTemplate: Template | undefined;
	state: DesignerState;
	isSubscribed: boolean;
	activeUsers: UserPresence[];
	onTemplateChange: (id: string) => void;
	onCreateNewTemplate: () => void;
	onZoomChange: (zoom: number) => void;
	isMobile?: boolean;
};

export function CanvasHeader({
	templates,
	currentTemplate,
	state,
	isSubscribed,
	activeUsers,
	onTemplateChange,
	onZoomChange,
	isMobile = false,
}: CanvasHeaderProps) {
	return (
		<div className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0">
			{/* Template selector - hidden on mobile (shown in layout header) */}
			{!isMobile && (
				<Select
					value={currentTemplate?.id ?? ""}
					onValueChange={onTemplateChange}
				>
					<SelectTrigger className="w-60">
						<SelectValue placeholder="Select a template" />
					</SelectTrigger>
					<SelectContent>
						{templates.map((t: Template) => (
							<SelectItem key={t.id} value={t.id}>
								{t.name}
							</SelectItem>
						))}
						<SelectItem value="new">
							<Plus className="h-4 w-4 mr-1" /> New template
						</SelectItem>
					</SelectContent>
				</Select>
			)}
			{!isMobile && isSubscribed && (
				<div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded shrink-0">
					<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
					<span>Live</span>
				</div>
			)}
			{!isMobile && <EnhancedPresenceIndicator users={activeUsers} />}
			<div className="ml-auto flex items-center gap-2 shrink-0">
				{!isMobile && (
					<Select
						value={String(state.zoom)}
						onValueChange={(v: string) => onZoomChange(Number(v))}
					>
						<SelectTrigger className="w-24">
							<SelectValue placeholder="Zoom" />
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
			</div>
		</div>
	);
}


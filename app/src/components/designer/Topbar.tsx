import { Upload, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Template } from "@/core";

export function DesignerTopbar({
	templates,
	currentTemplateId,
	onTemplateChange,
	zoom,
	onZoomChange,
	onPublish,
	onSave,
}: {
	templates: Template[];
	currentTemplateId?: string;
	onTemplateChange: (id: string) => void;
	zoom: number;
	onZoomChange: (z: number) => void;
	onPublish: () => void;
	onSave: () => void;
}) {
	return (
		<div className="px-3 py-2 border-b bg-white flex items-center gap-2">
			<Select
				value={currentTemplateId ?? ""}
				onValueChange={(id: string) => onTemplateChange(id)}
			>
				<SelectTrigger className="w-60">
					<SelectValue placeholder="Select a template" />
				</SelectTrigger>
				<SelectContent>
					{templates.map((t) => (
						<SelectItem key={t.id} value={t.id}>
							{t.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className="ml-auto flex items-center gap-2">
				<Select
					value={String(zoom)}
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
				<Button size="sm" onClick={onPublish}>
					<Upload className="h-4 w-4 mr-1" /> Publish
				</Button>
				<Button size="sm" onClick={onSave}>
					<Save className="h-4 w-4 mr-1" /> Save
				</Button>
			</div>
		</div>
	);
}



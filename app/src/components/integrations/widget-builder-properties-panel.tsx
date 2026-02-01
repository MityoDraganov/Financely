import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { DeleteWidgetDialog } from "./delete-widget-dialog";

const FIELD_BLOCK_TYPES = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"checkbox",
	"date",
	"submitButton",
] as const;

const REQUIRED_FIELD_TYPES = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"date",
] as const;

export function WidgetBuilderPropertiesPanel() {
	const ctx = useWidgetBuilderContext();
	const widgetDesigner = useWidgetDesigner();
	const selectedBlock = ctx?.selectedBlock;
	const onUpdateProps = ctx?.updateBlockProps ?? (() => {});
	const currentWidgetId = widgetDesigner?.currentWidgetId;
	const deleteWidgetId = ctx?.deleteWidgetId ?? null;
	const setDeleteWidgetId = ctx?.setDeleteWidgetId ?? (() => {});
	const onDeleteWidget = ctx?.onDeleteWidget;

	return (
		<aside className="w-fit shrink-0 min-w-[220px] overflow-y-auto border-l bg-muted/20">
			<div className="h-full overflow-y-auto p-4 flex flex-col">
				<h3 className="text-sm font-semibold mb-3">Properties</h3>
				{!selectedBlock ? (
					<p className="text-xs text-muted-foreground">
						Select a block to edit its properties.
					</p>
				) : (
					<div className="space-y-3">
						<div>
							<Label className="text-xs">Type</Label>
							<p className="text-sm font-medium">{selectedBlock.type}</p>
						</div>
						{selectedBlock.type === "sectionHeader" && (
							<>
								<div>
									<Label className="text-xs">Title</Label>
									<Input
										className="mt-1"
										value={
											(selectedBlock.props as { title?: string }).title ?? ""
										}
										onChange={(e) =>
											onUpdateProps(selectedBlock.id, {
												title: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Description</Label>
									<Input
										className="mt-1"
										value={
											(selectedBlock.props as { description?: string })
												.description ?? ""
										}
										onChange={(e) =>
											onUpdateProps(selectedBlock.id, {
												description: e.target.value,
											})
										}
									/>
								</div>
							</>
						)}
						{selectedBlock.type === "paragraph" && (
							<div>
								<Label className="text-xs">Content</Label>
								<Input
									className="mt-1"
									value={
										(selectedBlock.props as { content?: string }).content ?? ""
									}
									onChange={(e) =>
										onUpdateProps(selectedBlock.id, {
											content: e.target.value,
										})
									}
								/>
							</div>
						)}
						{FIELD_BLOCK_TYPES.includes(selectedBlock.type as (typeof FIELD_BLOCK_TYPES)[number]) && (
							<>
								<div>
									<Label className="text-xs">Label</Label>
									<Input
										className="mt-1"
										value={
											(selectedBlock.props as { label?: string }).label ?? ""
										}
										onChange={(e) =>
											onUpdateProps(selectedBlock.id, {
												label: e.target.value,
											})
										}
									/>
								</div>
								{selectedBlock.type !== "submitButton" && (
									<>
										<div>
											<Label className="text-xs">Field key</Label>
											<Input
												className="mt-1"
												value={
													(selectedBlock.props as { fieldKey?: string })
														.fieldKey ?? ""
												}
												onChange={(e) =>
													onUpdateProps(selectedBlock.id, {
														fieldKey: e.target.value,
													})
												}
											/>
										</div>
										<div>
											<Label className="text-xs">Placeholder</Label>
											<Input
												className="mt-1"
												value={
													(selectedBlock.props as { placeholder?: string })
														.placeholder ?? ""
												}
												onChange={(e) =>
													onUpdateProps(selectedBlock.id, {
														placeholder: e.target.value,
													})
												}
											/>
										</div>
									</>
								)}
							</>
						)}
						{selectedBlock.type === "successBlock" && (
							<>
								<div>
									<Label className="text-xs">Message</Label>
									<Input
										className="mt-1"
										value={
											(selectedBlock.props as { message?: string }).message ?? ""
										}
										onChange={(e) =>
											onUpdateProps(selectedBlock.id, {
												message: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Redirect URL</Label>
									<Input
										className="mt-1"
										value={
											(selectedBlock.props as { redirectUrl?: string })
												.redirectUrl ?? ""
										}
										onChange={(e) =>
											onUpdateProps(selectedBlock.id, {
												redirectUrl: e.target.value,
											})
										}
										placeholder="https://..."
									/>
								</div>
							</>
						)}
						{REQUIRED_FIELD_TYPES.includes(selectedBlock.type as (typeof REQUIRED_FIELD_TYPES)[number]) && (
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id={`builder-required-${selectedBlock.id}`}
									checked={
										(selectedBlock.props as { required?: boolean }).required ??
										false
									}
									onChange={(e) =>
										onUpdateProps(selectedBlock.id, {
											required: e.target.checked,
										})
									}
								/>
								<Label
									htmlFor={`builder-required-${selectedBlock.id}`}
									className="text-xs"
								>
									Required
								</Label>
							</div>
						)}
						{selectedBlock.type === "select" && (
							<div>
								<Label className="text-xs">Options (one per line)</Label>
								<Textarea
									className="mt-1 min-h-[80px]"
									value={(
										(selectedBlock.props as { options?: string[] }).options ??
										[]
									).join("\n")}
									onChange={(e) =>
										onUpdateProps(selectedBlock.id, {
											options: e.target.value
												.split("\n")
												.filter(Boolean),
										})
									}
								/>
							</div>
						)}
					</div>
				)}
				{currentWidgetId && onDeleteWidget && (
					<div className="mt-auto pt-4 border-t">
						<Button
							variant="outline"
							size="sm"
							className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
							onClick={() => setDeleteWidgetId(currentWidgetId)}
						>
							<Trash2 className="h-3.5 w-3.5 mr-1.5" />
							Delete widget
						</Button>
					</div>
				)}
			</div>
			{onDeleteWidget && (
				<DeleteWidgetDialog
					open={deleteWidgetId !== null}
					onOpenChange={(open) => !open && setDeleteWidgetId(null)}
					widgetId={deleteWidgetId}
					onConfirm={async (id) => {
						await onDeleteWidget(id);
						setDeleteWidgetId(null);
					}}
				/>
			)}
		</aside>
	);
}

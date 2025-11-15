import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Plus,
	Type as TypeIcon,
	ImageIcon,
	Table as TableIcon,
	Square,
	Minus,
	Lock,
	CircleDollarSign,
	Copy,
	Sparkles,
} from "lucide-react";
import { Template, TemplateElement } from "@/core";
import { toast } from "sonner";
import type { DesignerState } from "./designer-types";

type TemplateSidebarProps = {
	templates: Template[];
	currentTemplate: Template | undefined;
	state: DesignerState;
	onStateChange: (updater: (s: DesignerState) => DesignerState) => void;
	onCreateNewTemplate: () => void;
	onOpenAIBuilder: () => void;
	onAddElement: (kind: TemplateElement["type"]) => void;
	onSelectElement: (id: string) => void;
	onDuplicateElement: (id: string) => void;
	onDeleteElement: (id: string) => void;
	missingRequiredFields: Array<{
		binding: string;
		label: string;
		description?: string;
		elementType: "text" | "input" | "table";
	}>;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table") => void;
	isRequired: (binding: string | undefined) => boolean;
};

export function TemplateSidebar({
	templates,
	currentTemplate,
	state,
	onCreateNewTemplate,
	onOpenAIBuilder,
	onAddElement,
	onSelectElement,
	onDuplicateElement,
	onDeleteElement,
	missingRequiredFields,
	onAddRequiredElement,
	isRequired,
}: TemplateSidebarProps) {
	return (
		<div className="h-full p-4 border-r bg-gradient-to-b from-neutral-50 to-white overflow-y-auto">
			<div className="flex items-center justify-between mb-4">
				<div className="font-semibold text-base text-neutral-800">Templates</div>
			</div>
			<div className="mb-4 space-y-2.5">
				<Button
					variant="default"
					size="sm"
					className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
					onClick={onOpenAIBuilder}
				>
					<Sparkles className="h-4 w-4 mr-2 animate-pulse" />
					<span className="font-medium">AI Builder</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="w-full border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200 shadow-sm hover:shadow"
					onClick={onCreateNewTemplate}
				>
					<Plus className="h-4 w-4 mr-2" />
					New Template
				</Button>
			</div>
			<div className="space-y-2">
				{templates.length === 0 && (
					<div className="text-xs text-neutral-500">
						No templates yet. Click "New" to create your first template.
					</div>
				)}
			</div>
			{/* Required Fields Section */}
			{missingRequiredFields.length > 0 && currentTemplate && (
				<div className="mt-5 mb-5 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 shadow-sm">
					<div className="text-xs font-semibold uppercase text-amber-700 mb-2.5 flex items-center gap-1.5">
						<Lock className="h-3.5 w-3.5" />
						Required Fields
					</div>
					<div className="space-y-2">
						{missingRequiredFields.map((field) => (
							<Button
								key={field.binding}
								variant="outline"
								size="sm"
								onClick={() => {
									onAddRequiredElement(field.binding, field.label, field.elementType);
									toast.success(`Added ${field.label}`, { duration: 2000 });
								}}
								className="w-full justify-start text-xs h-auto py-2.5 px-3 border-amber-300/60 bg-white/80 hover:bg-amber-100 hover:border-amber-400 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
							>
								<Plus className="h-3.5 w-3.5 mr-2 text-amber-600" />
								<span className="text-left flex-1">
									<div className="font-semibold text-amber-900">{field.label}</div>
									{field.description && (
										<div className="text-xs text-amber-700/70 font-normal mt-0.5">{field.description}</div>
									)}
								</span>
							</Button>
						))}
					</div>
				</div>
			)}
			<div className="mt-5">
				<div className="text-xs font-semibold uppercase text-neutral-600 mb-3 flex items-center gap-2">
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
					<span>Palette</span>
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("text");
							toast.success("Text element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "text");
							e.dataTransfer.setData("text/plain", "text");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<TypeIcon className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Text</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("image");
							toast.success("Image element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "image");
							e.dataTransfer.setData("text/plain", "image");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<ImageIcon className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Image</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("table");
							toast.success("Table element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "table");
							e.dataTransfer.setData("text/plain", "table");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<TableIcon className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Table</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("input");
							toast.success("Input element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "input");
							e.dataTransfer.setData("text/plain", "input");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<TypeIcon className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Input</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("box");
							toast.success("Box element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "box");
							e.dataTransfer.setData("text/plain", "box");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<Square className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Box</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("line");
							toast.success("Line element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "line");
							e.dataTransfer.setData("text/plain", "line");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<Minus className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Line</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("currency");
							toast.success("Currency element added", { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "currency");
							e.dataTransfer.setData("text/plain", "currency");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
					>
						<CircleDollarSign className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">Currency</span>
					</Button>
				</div>
				<div className="mt-5">
					<div className="text-xs font-semibold uppercase text-neutral-600 mb-3 flex items-center gap-2">
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
						<span>Elements</span>
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{(currentTemplate?.elements ?? []).map((el) => {
							const binding = el.type === "text" ? el.binding :
								el.type === "input" ? el.binding :
								el.type === "image" ? el.binding :
								el.type === "table" ? el.itemsBinding : undefined;
							const isRequiredField = isRequired(binding);

							return (
								<ContextMenu key={el.id}>
									<ContextMenuTrigger asChild>
										<div
											className={`px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-lg cursor-pointer truncate transition-all duration-200 ${
												state.selectedElementId === el.id
													? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-2 border-blue-300 shadow-md"
													: "hover:bg-neutral-100 hover:shadow-sm border border-transparent hover:border-neutral-200"
											} ${isRequiredField ? "ring-1 ring-amber-300/50" : ""}`}
											onClick={() => onSelectElement(el.id)}
										>
											<div className="flex items-center gap-2">
												{isRequiredField && (
													<Lock className="h-3 w-3 text-amber-500 shrink-0" />
												)}
												{el.type === "text" && (
													<TypeIcon className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "image" && (
													<ImageIcon className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "table" && (
													<TableIcon className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "input" && (
													<TypeIcon className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "currency" && (
													<CircleDollarSign className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "box" && (
													<Square className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												{el.type === "line" && (
													<Minus className={`h-4 w-4 shrink-0 ${
														state.selectedElementId === el.id
															? "text-blue-600"
															: "text-neutral-500"
													}`} />
												)}
												<span className="truncate flex-1 text-sm">
													{(() => {
														if (el.type === "text") {
															return (el as Extract<TemplateElement, { type: "text" }>).text ?? "Text";
														} else if (el.type === "table") {
															return "Items Table";
														} else if (el.type === "image") {
															return "Image";
														} else if (el.type === "input") {
															return "Input Field";
														} else if (el.type === "currency") {
															return "Currency Field";
														} else if (el.type === "box") {
															return "Box";
														} else if (el.type === "line") {
															return "Line";
														}
														// Fallback for any other element type
														const element = el as TemplateElement;
														return `Element ${element.id.slice(0, 6)}`;
													})()}
												</span>
											</div>
										</div>
									</ContextMenuTrigger>
									<ContextMenuContent>
										<ContextMenuItem onClick={() => onSelectElement(el.id)}>
											Select
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem onClick={() => onDuplicateElement(el.id)}>
											<Copy className="mr-2 h-4 w-4" />
											Duplicate
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem onClick={() => onDeleteElement(el.id)} variant="destructive">
											Delete
										</ContextMenuItem>
									</ContextMenuContent>
								</ContextMenu>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}


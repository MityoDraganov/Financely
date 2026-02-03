import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2 } from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { DeleteWidgetDialog } from "./delete-widget-dialog";
import { Checkbox } from "../ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

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
	const pages = ctx?.pages ?? [];
	const activePageId = ctx?.activePageId ?? null;
	const activePage = pages.find((p) => p.id === activePageId) ?? null;
	const selectedBlock = ctx?.selectedBlock;
	const onUpdateProps = ctx?.updateBlockProps ?? (() => {});
	const updatePage = ctx?.updatePage ?? (() => {});
	const multiStepOptions = ctx?.multiStepOptions ?? {};
	const setMultiStepOptions = ctx?.setMultiStepOptions ?? (() => {});
	const currentWidgetId = widgetDesigner?.currentWidgetId;
	const deleteWidgetId = ctx?.deleteWidgetId ?? null;
	const setDeleteWidgetId = ctx?.setDeleteWidgetId ?? (() => {});
	const onDeleteWidget = ctx?.onDeleteWidget;

	return (
		<aside className="w-fit shrink-0 min-w-[220px] overflow-y-auto border-l bg-muted/20">
			<div className="h-full overflow-y-auto p-4 flex flex-col">
				<Tabs
					defaultValue="page-widget"
					className="flex flex-col flex-1 min-h-0"
				>
					<TabsList className="w-full grid grid-cols-2 mb-3 rounded-sm">
						<TabsTrigger value="block" className="rounded-sm">
							Block
						</TabsTrigger>
						<TabsTrigger value="page-widget" className="rounded-sm">
							Page & Widget
						</TabsTrigger>
					</TabsList>
					<TabsContent
						value="block"
						className="flex-1 mt-0 min-h-0 overflow-y-auto"
					>
						{!selectedBlock ? (
							<p className="text-xs text-muted-foreground">
								Select a field to edit its settings.
							</p>
						) : (
							<div className="space-y-3">
								<div>
									<Label className="text-xs">Type</Label>
									<p className="text-sm font-medium">
										{selectedBlock.type}
									</p>
								</div>
								{selectedBlock.type === "sectionHeader" && (
									<>
										<div>
											<Label className="text-xs">
												Title
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															title?: string;
														}
													).title ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															title: e.target
																.value,
														},
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">
												Description
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															description?: string;
														}
													).description ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															description:
																e.target.value,
														},
													)
												}
											/>
										</div>
									</>
								)}
								{selectedBlock.type === "paragraph" && (
									<div>
										<Label className="text-xs">
											Content
										</Label>
										<Input
											className="mt-1"
											value={
												(
													selectedBlock.props as {
														content?: string;
													}
												).content ?? ""
											}
											onChange={(e) =>
												onUpdateProps(
													selectedBlock.id,
													{
														content: e.target.value,
													},
												)
											}
										/>
									</div>
								)}
								{FIELD_BLOCK_TYPES.includes(
									selectedBlock.type as (typeof FIELD_BLOCK_TYPES)[number],
								) && (
									<>
										<div>
											<Label className="text-xs">
												Label
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															label?: string;
														}
													).label ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															label: e.target
																.value,
														},
													)
												}
											/>
										</div>
										{selectedBlock.type !==
											"submitButton" && (
											<>
												<div>
													<Label className="text-xs">
														Field key
													</Label>
													<Input
														className="mt-1"
														value={
															(
																selectedBlock.props as {
																	fieldKey?: string;
																}
															).fieldKey ?? ""
														}
														onChange={(e) =>
															onUpdateProps(
																selectedBlock.id,
																{
																	fieldKey:
																		e.target
																			.value,
																},
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">
														Placeholder
													</Label>
													<Input
														className="mt-1"
														value={
															(
																selectedBlock.props as {
																	placeholder?: string;
																}
															).placeholder ?? ""
														}
														onChange={(e) =>
															onUpdateProps(
																selectedBlock.id,
																{
																	placeholder:
																		e.target
																			.value,
																},
															)
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
											<Label className="text-xs">
												Message
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															message?: string;
														}
													).message ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															message:
																e.target.value,
														},
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">
												Redirect URL
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															redirectUrl?: string;
														}
													).redirectUrl ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															redirectUrl:
																e.target.value,
														},
													)
												}
												placeholder="https://..."
											/>
										</div>
									</>
								)}
								{REQUIRED_FIELD_TYPES.includes(
									selectedBlock.type as (typeof REQUIRED_FIELD_TYPES)[number],
								) && (
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id={`builder-required-${selectedBlock.id}`}
											checked={
												(
													selectedBlock.props as {
														required?: boolean;
													}
												).required ?? false
											}
											onChange={(e) =>
												onUpdateProps(
													selectedBlock.id,
													{
														required:
															e.target.checked,
													},
												)
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
								{selectedBlock.type === "select" &&
									(() => {
										const options: string[] =
											(
												selectedBlock.props as {
													options?: string[];
												}
											).options ?? [];
										return (
											<div>
												<Label className="text-xs">
													Options
												</Label>
												<div className="mt-1 space-y-2">
													{options.map((opt, i) => (
														<div
															key={i}
															className="flex items-center gap-2"
														>
															<Input
																className="flex-1 min-w-0 rounded-sm"
																value={opt}
																onChange={(e) =>
																	onUpdateProps(
																		selectedBlock.id,
																		{
																			options:
																				options.map(
																					(
																						o,
																						j,
																					) =>
																						j ===
																						i
																							? e
																									.target
																									.value
																							: o,
																				),
																		},
																	)
																}
															/>
															<Button
																type="button"
																variant="secondary"
																size="icon"
																className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
																onClick={() =>
																	onUpdateProps(
																		selectedBlock.id,
																		{
																			options:
																				options.filter(
																					(
																						_,
																						j,
																					) =>
																						j !==
																						i,
																				),
																		},
																	)
																}
																aria-label="Remove option"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													))}
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="w-full text-muted-foreground"
														onClick={() =>
															onUpdateProps(
																selectedBlock.id,
																{
																	options: [
																		...options,
																		"",
																	],
																},
															)
														}
													>
														+ Add option
													</Button>
												</div>
											</div>
										);
									})()}
							</div>
						)}
					</TabsContent>
					<TabsContent
						value="page-widget"
						className="flex-1 mt-0 min-h-0 overflow-y-auto flex flex-col"
					>
						{activePage && (
							<div className="space-y-3">
								<p className="text-xs font-medium text-muted-foreground">
									Page
								</p>
								<div>
									<Label className="text-xs">Name</Label>
									<Input
										className="mt-1"
										value={activePage.name}
										onChange={(e) =>
											updatePage(activePage.id, {
												name: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<Label className="text-xs">
										Description (optional)
									</Label>
									<Input
										className="mt-1"
										value={activePage.description ?? ""}
										onChange={(e) =>
											updatePage(activePage.id, {
												description:
													e.target.value || undefined,
											})
										}
										placeholder="Helper text for this page"
									/>
								</div>
							</div>
						)}
						<div className="space-y-3 border-t pt-3 mt-3">
							<p className="text-xs font-medium text-muted-foreground">
								Widget
							</p>
							<div className="flex items-center gap-2">
								<Checkbox
									id="builder-show-progress-bar"
									checked={
										multiStepOptions.showProgressBar ??
										false
									}
									onChange={(e) =>
										setMultiStepOptions({
											...multiStepOptions,
											showProgressBar: (
												e.target as HTMLInputElement
											).checked,
										})
									}
								/>
								<Label htmlFor="builder-show-progress-bar">
									Show progress bar
								</Label>
							</div>
							{(multiStepOptions.showProgressBar ?? false) && (
								<div>
									<Label className="text-xs">
										Progress bar position
									</Label>
									<Select
										value={
											multiStepOptions.progressBarPosition ??
											"top"
										}
										onValueChange={(value) =>
											setMultiStepOptions({
												...multiStepOptions,
												progressBarPosition: value as "top" | "bottom",
											})
										}
									>
										<SelectTrigger className="mt-1 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="top">Top</SelectItem>
											<SelectItem value="bottom">Bottom</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
							<div>
								<Label className="text-xs">
									Progress style
								</Label>
								<Select
									value={
										multiStepOptions.progressStyle ??
										"steps"
									}
									onValueChange={(value) =>
										setMultiStepOptions({
											...multiStepOptions,
											progressStyle: value as "steps" | "percentage",
										})
									}
								>
									<SelectTrigger className="mt-1 w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="steps">
											Steps (Page 1 / Page 2)
										</SelectItem>
										<SelectItem value="percentage">
											Percentage
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className="text-xs">Next label</Label>
								<Input
									className="mt-1"
									value={multiStepOptions.nextLabel ?? ""}
									onChange={(e) =>
										setMultiStepOptions({
											...multiStepOptions,
											nextLabel:
												e.target.value || undefined,
										})
									}
									placeholder="Continue"
								/>
							</div>
							<div>
								<Label className="text-xs">Back label</Label>
								<Input
									className="mt-1"
									value={multiStepOptions.backLabel ?? ""}
									onChange={(e) =>
										setMultiStepOptions({
											...multiStepOptions,
											backLabel:
												e.target.value || undefined,
										})
									}
									placeholder="Back"
								/>
							</div>
							<div>
								<Label className="text-xs">Submit label</Label>
								<Input
									className="mt-1"
									value={multiStepOptions.submitLabel ?? ""}
									onChange={(e) =>
										setMultiStepOptions({
											...multiStepOptions,
											submitLabel:
												e.target.value || undefined,
										})
									}
									placeholder="Submit"
								/>
							</div>
						</div>
						{currentWidgetId && onDeleteWidget && (
							<div className="mt-auto pt-4 border-t">
								<Button
									variant="outline"
									size="sm"
									className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
									onClick={() =>
										setDeleteWidgetId(currentWidgetId)
									}
								>
									<Trash2 className="h-3.5 w-3.5 mr-1.5" />
									Delete widget
								</Button>
							</div>
						)}
					</TabsContent>
				</Tabs>
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

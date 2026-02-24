import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Loader2, History, CheckCircle2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

function formatVersionTimestamp(value: unknown): string {
	if (!value) return "Recently";
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? "Recently" : value.toLocaleString();
	}
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
	}
	if (typeof value === "object" && value !== null) {
		if ("toDate" in value && typeof value.toDate === "function") {
			const parsed = value.toDate();
			return parsed instanceof Date && !Number.isNaN(parsed.getTime())
				? parsed.toLocaleString()
				: "Recently";
		}
		if ("seconds" in value && typeof value.seconds === "number") {
			return new Date(value.seconds * 1000).toLocaleString();
		}
		if ("_seconds" in value && typeof value._seconds === "number") {
			return new Date(value._seconds * 1000).toLocaleString();
		}
	}
	return "Recently";
}

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
	const versions = ctx?.versions ?? [];
	const selectedVersionId = ctx?.selectedVersionId ?? null;
	const selectedVersion = versions.find((v) => v.id === selectedVersionId);
	const widgetName = ctx?.widgetName ?? "";
	const setWidgetName = ctx?.setWidgetName ?? (() => {});
	const handleWidgetNameBlur = ctx?.handleWidgetNameBlur ?? (async () => {});
	const widgetNameSaving = ctx?.widgetNameSaving ?? false;
	const currentWidgetId = widgetDesigner?.currentWidgetId;
	const deleteWidgetId = ctx?.deleteWidgetId ?? null;
	const setDeleteWidgetId = ctx?.setDeleteWidgetId ?? (() => {});
	const onDeleteWidget = ctx?.onDeleteWidget;

	return (
		<aside className="w-80 shrink-0 h-full min-h-0 overflow-hidden border-l bg-muted/20 flex flex-col">
			<div className="h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
				<Tabs
					defaultValue="page-widget"
					className="flex flex-col flex-1 min-h-0"
				>
					<div className="px-4 pt-4">
						<TabsList className="w-full grid grid-cols-2 mb-3 rounded-sm">
							<TabsTrigger value="block" className="rounded-sm">
								Block
							</TabsTrigger>
							<TabsTrigger value="page-widget" className="rounded-sm">
								Page & Widget
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent
						value="block"
						className="flex-1 mt-0 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4"
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
						className="flex-1 mt-0 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
					>
						<div className="px-4 pb-4">
							{currentWidgetId && (
								<div className="space-y-1.5">
									<Label className="text-xs">Widget name</Label>
									<Input
										value={widgetName}
										onChange={(e) => setWidgetName(e.target.value)}
										onBlur={() => void handleWidgetNameBlur()}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											(e.target as HTMLInputElement).blur()
										}
										placeholder="Widget name"
										disabled={widgetNameSaving}
										className="h-9"
									/>
								</div>
							)}
							{activePage && (
								<div className="space-y-3 mt-3">
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
						</div>
						<div className="space-y-2 border-t pt-3 mt-3">
							<p className="px-4 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
								<History className="h-3.5 w-3.5" />
								Version history
							</p>
							{ctx?.versionsLoading ? (
								<div className="flex items-center justify-center px-4 py-4">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							) : versions.length === 0 ? (
								<p className="px-4 text-xs text-muted-foreground">No versions yet.</p>
							) : (
								<div className="relative">
									<div className="space-y-1 px-4">
										{versions.map((version) => {
											const isSelected = selectedVersionId === version.id;
											const isPublished = ctx?.publishedVersionId === version.id;
											return (
												<button
													key={version.id}
													type="button"
													onClick={() => ctx?.setSelectedVersionId(version.id)}
													className={cn(
														"w-full rounded border px-2 py-1.5 text-left",
														isSelected
															? "border-primary bg-primary/5"
															: "border-transparent bg-background hover:bg-muted/50",
													)}
												>
													<div className="flex items-center justify-between gap-1.5">
														<span className="text-xs font-medium">
															v{version.versionNumber}
														</span>
														{isPublished ? (
															<CheckCircle2 className="h-3.5 w-3.5 text-primary" />
														) : null}
													</div>
													<p className="mt-1 text-[11px] text-muted-foreground">
														{formatVersionTimestamp(version.createdAt)}
													</p>
												</button>
											);
										})}
									</div>
									<div className="sticky bottom-0 mt-2">
										<div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-muted/95 via-muted/60 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_top,black,transparent)]" />
										<div className="relative bg-muted/95 px-4 pt-2 pb-1">
											<div className="grid gap-1.5">
												<Button
													variant="outline"
													size="sm"
													className="h-8 text-xs"
													onClick={() =>
														selectedVersion && void ctx?.publishVersion(selectedVersion.id)
													}
													disabled={
														!selectedVersion ||
														ctx?.publishing ||
														ctx?.publishingVersionId != null ||
														ctx?.unpublishing ||
														ctx?.publishedVersionId === selectedVersion.id
													}
												>
													{ctx?.publishingVersionId === selectedVersion?.id ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : null}
													Publish selected
												</Button>
												<Button
													size="sm"
													className="h-8 text-xs"
													onClick={() =>
														selectedVersion && void ctx?.restoreVersion(selectedVersion.id)
													}
													disabled={
														!selectedVersion ||
														ctx?.restoringVersion ||
														ctx?.saving ||
														ctx?.publishing
													}
												>
													{ctx?.restoringVersion ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : null}
													Restore selected
												</Button>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</TabsContent>
					</Tabs>
			</div>
			{currentWidgetId && onDeleteWidget && (
				<div className="shrink-0 border-t bg-muted px-4 py-3">
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Plus,
	Save,
	Upload,
	MousePointer2,
	Type as TypeIcon,
	ImageIcon,
	Table as TableIcon,
	Square,
	Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Template, TemplateData, TemplateElement } from "@/core";
import { templateService } from "@/services/template-service";

type DesignerState = {
	currentTemplateId?: string;
	selectedElementId?: string;
	zoom: number;
};

type DragState = {
	elementId: string;
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
};

export default function TemplateDesignerPage() {
	const queryClient = useQueryClient();
	const [state, setState] = useState<DesignerState>({ zoom: 1 });
	const [drag, setDrag] = useState<DragState | null>(null);
	const [draftElements, setDraftElements] = useState<
		TemplateElement[] | null
	>(null);
	const draftRef = useRef<TemplateElement[] | null>(null);
	const currentTemplateRef = useRef<Template | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);
	const { data: templates = [] } = useQuery<Template[]>({
		queryKey: ["templates"],
		queryFn: () => templateService.listTemplates("demo-org"),
	});

	const currentTemplate = useMemo(() => {
		return (
			templates.find((t: Template) => t.id === state.currentTemplateId) ??
			templates[0]
		);
	}, [templates, state.currentTemplateId]);

	// Keep refs in sync for stable event handlers
	useEffect(() => {
		draftRef.current = draftElements;
	}, [draftElements]);

	useEffect(() => {
		currentTemplateRef.current = currentTemplate ?? null;
	}, [currentTemplate]);

	// Ensure a template is selected once templates load
	useEffect(() => {
		if (templates.length > 0 && !state.currentTemplateId) {
			setState((s: DesignerState) => ({
				...s,
				currentTemplateId: templates[0].id,
			}));
		}
	}, [templates, state.currentTemplateId]);

	const saveMutation = useMutation({
		mutationFn: async (partial: Partial<TemplateData>) => {
			if (!currentTemplate) return;
			await templateService.updateDraft(currentTemplate.id, partial);
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["templates"] }),
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			const empty: TemplateData = {
				orgId: "demo-org",
				name: "New Invoice Template",
				description: "",
				pageSize: "A4",
				brand: {
					fonts: ["Inter"],
					colors: {
						primary: "#111827",
						secondary: "#6b7280",
						accent: "#2563eb",
					},
					margins: { top: 40, right: 40, bottom: 40, left: 40 },
				},
				elements: [],
				status: "draft",
			};
			return templateService.createDraft(empty);
		},
		onSuccess: (id: string) => {
			setState((s: DesignerState) => ({ ...s, currentTemplateId: id }));
			queryClient.invalidateQueries({ queryKey: ["templates"] });
		},
	});

	const publishMutation = useMutation({
		mutationFn: async () => {
			if (!currentTemplate) return { versionId: "", version: 0 };
			return templateService.publish(currentTemplate.id);
		},
	});

	function addElement(
		kind: TemplateElement["type"],
		at?: { x: number; y: number }
	) {
		if (!currentTemplate) return;
		const newElement: TemplateElement =
			kind === "text"
				? {
						id: crypto.randomUUID(),
						type: "text",
						x: at?.x ?? 60,
						y: at?.y ?? 80,
						width: 200,
						height: 40,
						rotation: 0,
						zIndex: 1,
						visible: true,
						text: "Text",
						typography: {
							fontFamily: "Inter",
							fontSize: 12,
							fontWeight: "normal",
							lineHeight: 1.2,
							letterSpacing: 0,
							color: "#111827",
							align: "left",
							uppercase: false,
							lowercase: false,
						},
						format: { kind: "none" },
					}
				: kind === "image"
					? {
							id: crypto.randomUUID(),
							type: "image",
							x: at?.x ?? 60,
							y: at?.y ?? 80,
							width: 120,
							height: 60,
							rotation: 0,
							zIndex: 1,
							visible: true,
							src: "",
							objectFit: "contain",
						}
					: kind === "table"
						? {
								id: crypto.randomUUID(),
								type: "table",
								x: at?.x ?? 60,
								y: at?.y ?? 160,
								width: 420,
								height: 200,
								rotation: 0,
								zIndex: 1,
								visible: true,
								rowHeight: 28,
								headerHeight: 28,
								stripe: true,
								columns: [],
								itemsBinding: "invoice.items",
								totals: [],
							}
						: kind === "box"
							? {
									id: crypto.randomUUID(),
									type: "box",
									x: at?.x ?? 40,
									y: at?.y ?? 40,
									width: 200,
									height: 80,
									rotation: 0,
									zIndex: 0,
									visible: true,
									fill: "#ffffff00",
									stroke: "#e5e7eb",
									strokeWidth: 1,
									radius: 0,
								}
							: {
									id: crypto.randomUUID(),
									type: "line",
								x: at?.x ?? 40,
								y: at?.y ?? 140,
									width: 200,
									height: 1,
									rotation: 0,
									zIndex: 0,
									visible: true,
									x2: 240,
									y2: 140,
									stroke: "#e5e7eb",
									strokeWidth: 1,
								};
		saveMutation.mutate({
			elements: [...(currentTemplate?.elements ?? []), newElement],
		});
	}

	function updateSelected(partial: Partial<TemplateElement>) {
		if (!currentTemplate || !state.selectedElementId) return;
		const next = (currentTemplate.elements ?? []).map(
			(el: TemplateElement) =>
				el.id === state.selectedElementId
					? ({ ...el, ...partial } as TemplateElement)
					: el
		);
		saveMutation.mutate({ elements: next });
	}

	// Global pointer handlers during drag
	useEffect(() => {
		if (!drag) return;

		const { startClientX, startClientY, startX, startY, elementId } = drag;

		function handlePointerMove(ev: PointerEvent) {
			const dx = (ev.clientX - startClientX) / state.zoom;
			const dy = (ev.clientY - startClientY) / state.zoom;
			setDraftElements((prev: TemplateElement[] | null) => {
				const base = prev ?? currentTemplateRef.current?.elements ?? [];
				return base.map((item) =>
					item.id === elementId
						? { ...item, x: startX + dx, y: startY + dy }
						: item
				);
			});
		}

		function handlePointerUp() {
			const latestDraft = draftRef.current;
			const tmpl = currentTemplateRef.current;
			if (latestDraft && tmpl) {
				saveMutation.mutate({ elements: latestDraft });
			}
			setDrag(null);
			setDraftElements(null);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [drag, state.zoom, saveMutation]);

	return (
		<div className="flex h-screen">
			<ResizablePanelGroup direction="horizontal">
				<ResizablePanel defaultSize={18} minSize={16}>
					<div className="h-full p-3 border-r bg-neutral-50">
						<div className="flex items-center justify-between mb-3">
							<div className="font-medium">Templates</div>
							<Button
								size="sm"
								onClick={() => createMutation.mutate()}
							>
								<Plus className="mr-1 h-4 w-4" /> New
							</Button>
						</div>
						<div className="space-y-2">
							{templates.map((t: Template) => (
								<Card
									key={t.id}
									className={`p-3 cursor-pointer ${t.id === currentTemplate?.id ? "ring-2 ring-blue-500" : ""}`}
									onClick={() =>
										setState((s: DesignerState) => ({
											...s,
											currentTemplateId: t.id,
										}))
									}
								>
									<div className="text-sm font-medium">
										{t.name}
									</div>
									<div className="text-xs text-neutral-500">
										{t.status}
									</div>
								</Card>
							))}
						</div>
						<div className="mt-4">
							<div className="text-xs uppercase text-neutral-500 mb-2">
								Palette
							</div>
							<div className="grid grid-cols-2 gap-2">
								<Button
									variant="secondary"
								onClick={() => addElement("text")}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData(
										"application/x-template-element",
										"text"
									);
									e.dataTransfer.effectAllowed = "copy";
								}}
								>
									{" "}
									<TypeIcon className="h-4 w-4 mr-1" /> Text
								</Button>
								<Button
									variant="secondary"
								onClick={() => addElement("image")}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData(
										"application/x-template-element",
										"image"
									);
									e.dataTransfer.effectAllowed = "copy";
								}}
								>
									{" "}
									<ImageIcon className="h-4 w-4 mr-1" /> Image
								</Button>
								<Button
									variant="secondary"
								onClick={() => addElement("table")}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData(
										"application/x-template-element",
										"table"
									);
									e.dataTransfer.effectAllowed = "copy";
								}}
								>
									{" "}
									<TableIcon className="h-4 w-4 mr-1" /> Table
								</Button>
								<Button
									variant="secondary"
								onClick={() => addElement("box")}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData(
										"application/x-template-element",
										"box"
									);
									e.dataTransfer.effectAllowed = "copy";
								}}
								>
									{" "}
									<Square className="h-4 w-4 mr-1" /> Box
								</Button>
								<Button
									variant="secondary"
								onClick={() => addElement("line")}
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData(
										"application/x-template-element",
										"line"
									);
									e.dataTransfer.effectAllowed = "copy";
								}}
								>
									{" "}
									<Minus className="h-4 w-4 mr-1" /> Line
								</Button>
							</div>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel minSize={40}>
					<div className="h-full flex flex-col">
						<div className="px-3 py-2 border-b bg-white flex items-center gap-2">
							<Button variant="outline" size="sm">
								<MousePointer2 className="h-4 w-4 mr-1" />{" "}
								Select
							</Button>
							<div className="ml-auto flex items-center gap-2">
								<Select
									value={String(state.zoom)}
									onValueChange={(v: string) =>
										setState((s: DesignerState) => ({
											...s,
											zoom: Number(v),
										}))
									}
								>
									<SelectTrigger className="w-24">
										<SelectValue placeholder="Zoom" />
									</SelectTrigger>
									<SelectContent>
										{[0.75, 1, 1.25, 1.5, 2].map((z) => (
											<SelectItem
												key={z}
												value={String(z)}
											>
												{Math.round(z * 100)}%
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									size="sm"
									onClick={() => publishMutation.mutate()}
								>
									<Upload className="h-4 w-4 mr-1" /> Publish
								</Button>
								<Button
									size="sm"
									onClick={() =>
										currentTemplate &&
										saveMutation.mutate({})
									}
								>
									<Save className="h-4 w-4 mr-1" /> Save
								</Button>
							</div>
						</div>
						<div className="flex-1 overflow-auto bg-neutral-100 grid place-items-center">
						<div
							ref={pageRef}
							className="bg-white shadow-xl relative"
							style={{
								width: 794 * state.zoom,
								height: 1123 * state.zoom,
							}}
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = "copy";
							}}
							onDrop={(e) => {
								e.preventDefault();
								const type =
									e.dataTransfer.getData(
										"application/x-template-element"
									) || (e.dataTransfer.getData("text/plain") as TemplateElement["type"]);
								if (!type) return;
								const rect = pageRef.current?.getBoundingClientRect();
								if (!rect) return;
								const x = (e.clientX - rect.left) / state.zoom;
								const y = (e.clientY - rect.top) / state.zoom;
								addElement(type as TemplateElement["type"], {
									x: Math.max(0, Math.round(x)),
									y: Math.max(0, Math.round(y)),
								});
							}}
						>
								{/* grid */}
								<div
									className="absolute inset-0 z-0"
									style={{
										backgroundSize: `${8 * state.zoom}px ${8 * state.zoom}px`,
										backgroundImage: `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)`,
									}}
								/>
								{/* elements */}
								{(
									draftElements ??
									currentTemplate?.elements ??
									[]
								).map((el: TemplateElement) => (
									<div
										key={el.id}
									className={`absolute ${state.selectedElementId === el.id ? "ring-2 ring-blue-500" : ""} ${drag?.elementId === el.id ? "cursor-grabbing" : "cursor-grab"}`}
										style={{
											left: el.x * state.zoom,
											top: el.y * state.zoom,
											width: el.width * state.zoom,
											height: el.height * state.zoom,
											transform: `rotate(${el.rotation}deg)`,
											touchAction: "none",
										}}
										onClick={() => {
											setState((s: DesignerState) => ({
												...s,
												selectedElementId: el.id,
											}));
											console.log("clicked", el.id);
										}}
										onPointerDown={(e) => {
											console.log("pointer down", e);
											// Begin drag for this element
											e.preventDefault();
											e.stopPropagation();
											setState((s: DesignerState) => ({
												...s,
												selectedElementId: el.id,
											}));
											setDraftElements(
												(
													currentTemplate?.elements ??
													[]
												).map((x) => ({ ...x }))
											);
											setDrag({
												elementId: el.id,
												startClientX: e.clientX,
												startClientY: e.clientY,
												startX: el.x,
												startY: el.y,
											});
										}}
									>
										{el.type === "text" &&
											(() => {
												const t = el as Extract<
													TemplateElement,
													{ type: "text" }
												>;
												return (
													<div
														className="p-1"
														style={{
															fontFamily:
																t.typography
																	.fontFamily,
															fontSize:
																t.typography
																	.fontSize *
																state.zoom,
															fontWeight:
																t.typography
																	.fontWeight,
															lineHeight:
																t.typography
																	.lineHeight,
															letterSpacing:
																t.typography
																	.letterSpacing,
															color: t.typography
																.color,
															textAlign:
																t.typography
																	.align,
														}}
													>
														{t.text}
													</div>
												);
											})()}
										{el.type === "image" && (
											<div className="w-full h-full bg-neutral-100 grid place-items-center text-neutral-400">
												Image
											</div>
										)}
										{el.type === "box" &&
											(() => {
												const b = el as Extract<
													TemplateElement,
													{ type: "box" }
												>;
												return (
													<div
														className="w-full h-full"
														style={{
															background: b.fill,
															border: `${b.strokeWidth}px solid ${b.stroke}`,
															borderRadius:
																b.radius,
														}}
													/>
												);
											})()}
										{el.type === "line" &&
											(() => {
												const ln = el as Extract<
													TemplateElement,
													{ type: "line" }
												>;
												return (
													<div
														className="absolute top-1/2 left-0 right-0 border-t"
														style={{
															borderColor:
																ln.stroke,
															borderWidth:
																ln.strokeWidth,
														}}
													/>
												);
											})()}
										{el.type === "table" && (
											<div className="w-full h-full border border-neutral-200 text-[10px] text-neutral-600 grid place-items-center">
												Table
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={22} minSize={18}>
					<div className="h-full p-3 border-l bg-neutral-50 space-y-3">
						<div className="font-medium">Properties</div>
						{!currentTemplate && (
							<div className="text-sm text-neutral-500">
								Create a template to begin.
							</div>
						)}
						{currentTemplate && (
							<div className="space-y-4">
								<div>
									<div className="text-xs text-neutral-500 mb-1">
										Name
									</div>
									<Input
										value={currentTemplate.name}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>
										) =>
											saveMutation.mutate({
												name: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<div className="text-xs text-neutral-500 mb-1">
										Page Size
									</div>
									<Select
										value={currentTemplate.pageSize}
										onValueChange={(v: string) =>
											saveMutation.mutate({
												pageSize:
													v as TemplateData["pageSize"],
											})
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="A4">
												A4
											</SelectItem>
											<SelectItem value="Letter">
												Letter
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{state.selectedElementId && (
									<ElementProperties
										element={
											(
												currentTemplate.elements ?? []
											).find(
												(e: TemplateElement) =>
													e.id ===
													state.selectedElementId
											)!
										}
										onChange={updateSelected}
									/>
								)}
							</div>
						)}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
}) {
	if (element.type === "text") {
		return (
			<div className="space-y-2">
				<div className="text-xs font-medium">Text</div>
				{(() => {
					const t = element as Extract<
						TemplateElement,
						{ type: "text" }
					>;
					return (
						<Input
							value={t.text ?? ""}
							onChange={(e) =>
								onChange({
									id: element.id,
									type: "text",
									x: element.x,
									y: element.y,
									width: element.width,
									height: element.height,
									rotation: element.rotation,
									zIndex: element.zIndex,
									visible: element.visible,
									text: e.target.value,
									typography: t.typography,
									format: t.format,
								})
							}
						/>
					);
				})()}
				<div className="grid grid-cols-2 gap-2">
					<Input
						type="number"
						value={element.x}
						onChange={(e) =>
							onChange({ x: Number(e.target.value) })
						}
					/>
					<Input
						type="number"
						value={element.y}
						onChange={(e) =>
							onChange({ y: Number(e.target.value) })
						}
					/>
					<Input
						type="number"
						value={element.width}
						onChange={(e) =>
							onChange({ width: Number(e.target.value) })
						}
					/>
					<Input
						type="number"
						value={element.height}
						onChange={(e) =>
							onChange({ height: Number(e.target.value) })
						}
					/>
				</div>
			</div>
		);
	}
	return (
		<div className="text-xs text-neutral-500">
			Select an element to edit.
		</div>
	);
}

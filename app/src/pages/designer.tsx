import { useEffect, useMemo, useRef, useState } from "react";
import { signInAnonymously } from "@firebase/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Plus,
	Save,
	Upload,
	Type as TypeIcon,
	ImageIcon,
	Table as TableIcon,
	Square,
	Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Template, TemplateData, TemplateElement } from "@/core";
import { templateService } from "@/services/template-service";
import { firebase } from "@/infrastructure";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";

type DesignerState = {
	currentTemplateId?: string;
	selectedElementId?: string;
	zoom: number;
};

type DragMode = "move" | "resize";

type DragState = {
	elementId: string;
	mode: DragMode;
	edge?: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startWidth?: number;
	startHeight?: number;
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
	const { data: templates = [] } = useTemplates();
	console.log("templates", templates);

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

	// Reset selection when template changes to avoid stale element ids
	useEffect(() => {
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: undefined,
		}));
	}, [state.currentTemplateId]);

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

	const PAGE_WIDTH = 794;
	const PAGE_HEIGHT = 1123;

	function clampMove(x: number, y: number, width: number, height: number) {
		const maxX = Math.max(0, PAGE_WIDTH - width);
		const maxY = Math.max(0, PAGE_HEIGHT - height);
		return {
			x: Math.min(Math.max(0, x), maxX),
			y: Math.min(Math.max(0, y), maxY),
		};
	}

	function clampResize(x: number, y: number, width: number, height: number) {
		const minW = 8;
		const minH = 8;
		let nextX = x;
		let nextY = y;
		let nextW = Math.max(minW, width);
		let nextH = Math.max(minH, height);
		if (nextX < 0) {
			nextW = Math.max(minW, nextW + nextX);
			nextX = 0;
		}
		if (nextY < 0) {
			nextH = Math.max(minH, nextH + nextY);
			nextY = 0;
		}
		if (nextX + nextW > PAGE_WIDTH) {
			nextW = Math.max(minW, PAGE_WIDTH - nextX);
		}
		if (nextY + nextH > PAGE_HEIGHT) {
			nextH = Math.max(minH, PAGE_HEIGHT - nextY);
		}
		return { x: nextX, y: nextY, width: nextW, height: nextH };
	}

	function handleCanvasDragOver(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		console.log("[DND] canvas dragover", {
			target: (e.target as HTMLElement)?.className,
			currentTarget: (e.currentTarget as HTMLElement)?.className,
		});
		try {
			e.dataTransfer.dropEffect = "copy";
		} catch {
			/* no-op */
		}
	}

	async function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		const raw =
			e.dataTransfer.getData("application/x-template-element") ||
			e.dataTransfer.getData("text/plain");
		const type = (raw as TemplateElement["type"]) || undefined;
		console.log("[DND] canvas drop", {
			raw,
			type,
			target: (e.target as HTMLElement)?.className,
			currentTarget: (e.currentTarget as HTMLElement)?.className,
		});
		if (!type) return;
		if (!currentTemplate) {
			console.log(
				"[DND] no current template; creating one before drop..."
			);
			try {
				if (!firebase.auth.currentUser) {
					console.log(
						"[AUTH] signing in anonymously before creating template..."
					);
					await signInAnonymously(firebase.auth);
				}
				const newId = await (
					createMutation as unknown as {
						mutateAsync: () => Promise<string | undefined>;
					}
				).mutateAsync();
				if (newId && typeof newId === "string") {
					setState((s: DesignerState) => ({
						...s,
						currentTemplateId: newId,
					}));
					console.log("[DND] created template", newId);
				}
			} catch (err) {
				console.error("[DND] failed to create template for drop", err);
				return;
			}
		}
		const rect = pageRef.current?.getBoundingClientRect();
		console.log("[DND] page rect", rect);
		if (!rect) return;
		const x = (e.clientX - rect.left) / state.zoom;
		const y = (e.clientY - rect.top) / state.zoom;
		console.log("[DND] computed drop coords", { x, y, zoom: state.zoom });
		addElement(type, {
			x: Math.max(0, Math.min(Math.round(x), PAGE_WIDTH - 1)),
			y: Math.max(0, Math.min(Math.round(y), PAGE_HEIGHT - 1)),
		});
	}

	function addElement(
		kind: TemplateElement["type"],
		at?: { x: number; y: number }
	) {
		if (!currentTemplate) return;
		console.log("[ADD] addElement called", {
			kind,
			at,
			templateId: currentTemplate.id,
		});
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
		console.log("[ADD] new element", newElement);
		// Clamp initial position so element appears fully in frame
		const clampedAt = clampMove(
			newElement.x,
			newElement.y,
			newElement.width,
			newElement.height
		);
		const nextElement = {
			...newElement,
			x: clampedAt.x,
			y: clampedAt.y,
		} as TemplateElement;
		const next = [...(currentTemplate?.elements ?? []), nextElement];
		console.log("[ADD] next elements length", next.length);
		// optimistic UI update so drop shows immediately
		setDraftElements(next);
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: nextElement.id,
		}));
		console.log("[ADD] persisting draft via saveMutation.mutate");
		saveMutation.mutate({ elements: next });
	}

	function updateSelected(partial: Partial<TemplateElement>) {
		if (!currentTemplate || !state.selectedElementId) return;
		const next = (currentTemplate.elements ?? []).map(
			(el: TemplateElement) =>
				el.id === state.selectedElementId
					? ((): TemplateElement => {
							const merged = {
								...el,
								...partial,
							} as TemplateElement;
							const clampedMove = clampMove(
								merged.x,
								merged.y,
								merged.width,
								merged.height
							);
							return {
								...merged,
								x: clampedMove.x,
								y: clampedMove.y,
							} as TemplateElement;
						})()
					: el
		);
		saveMutation.mutate({ elements: next });
	}

	function deleteElement(id: string) {
		if (!currentTemplate) return;
		const next = (currentTemplate.elements ?? []).filter((e) => e.id !== id);
		saveMutation.mutate({ elements: next });
		setState((s: DesignerState) => ({ ...s, selectedElementId: undefined }));
	}

	// Global pointer handlers during drag
	useEffect(() => {
		if (!drag) return;

		const {
			startClientX,
			startClientY,
			startX,
			startY,
			elementId,
			mode,
			edge,
			startWidth,
			startHeight,
		} = drag;

		function handlePointerMove(ev: PointerEvent) {
			const dx = (ev.clientX - startClientX) / state.zoom;
			const dy = (ev.clientY - startClientY) / state.zoom;
			setDraftElements((prev: TemplateElement[] | null) => {
				const base = prev ?? currentTemplateRef.current?.elements ?? [];
				return base.map((item) => {
					if (item.id !== elementId) return item;
					if (mode === "move") {
						const clamped = clampMove(
							startX + dx,
							startY + dy,
							item.width,
							item.height
						);
						return { ...item, x: clamped.x, y: clamped.y };
					}
					// resize logic
					let nextX = startX;
					let nextY = startY;
					let nextW = startWidth ?? item.width;
					let nextH = startHeight ?? item.height;
					if (edge?.includes("e"))
						nextW = Math.max(1, (startWidth ?? item.width) + dx);
					if (edge?.includes("s"))
						nextH = Math.max(1, (startHeight ?? item.height) + dy);
					if (edge?.includes("w")) {
						nextX = startX + dx;
						nextW = Math.max(1, (startWidth ?? item.width) - dx);
					}
					if (edge?.includes("n")) {
						nextY = startY + dy;
						nextH = Math.max(1, (startHeight ?? item.height) - dy);
					}
					const clamped = clampResize(nextX, nextY, nextW, nextH);
					return {
						...item,
						x: clamped.x,
						y: clamped.y,
						width: clamped.width,
						height: clamped.height,
					};
				});
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
							{templates.length === 0 && (
								<div className="text-xs text-neutral-500">
									No templates yet. Click "New" to create your
									first template.
								</div>
							)}
						</div>
						<div className="mt-4">
							<div className="text-xs uppercase text-neutral-500 mb-2">
								Palette
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
								<Button
									variant="secondary"
									onClick={() => addElement("text")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: text");
										e.dataTransfer.setData(
											"application/x-template-element",
											"text"
										);
										e.dataTransfer.setData(
											"text/plain",
											"text"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<TypeIcon className="h-4 w-4 mr-1" /> Text
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("image")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: image");
										e.dataTransfer.setData(
											"application/x-template-element",
											"image"
										);
										e.dataTransfer.setData(
											"text/plain",
											"image"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<ImageIcon className="h-4 w-4 mr-1" /> Image
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("table")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: table");
										e.dataTransfer.setData(
											"application/x-template-element",
											"table"
										);
										e.dataTransfer.setData(
											"text/plain",
											"table"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<TableIcon className="h-4 w-4 mr-1" /> Table
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("box")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: box");
										e.dataTransfer.setData(
											"application/x-template-element",
											"box"
										);
										e.dataTransfer.setData(
											"text/plain",
											"box"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<Square className="h-4 w-4 mr-1" /> Box
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("line")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: line");
										e.dataTransfer.setData(
											"application/x-template-element",
											"line"
										);
										e.dataTransfer.setData(
											"text/plain",
											"line"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<Minus className="h-4 w-4 mr-1" /> Line
								</Button>
							</div>
							<div className="mt-4">
								<div className="text-xs uppercase text-neutral-500 mb-2">Elements</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
									{(currentTemplate?.elements ?? []).map((el) => (
										<ContextMenu key={el.id}>
											<ContextMenuTrigger asChild>
												<div
													className={`px-2 py-2 min-w-0 w-full text-xs sm:text-sm rounded cursor-pointer truncate ${state.selectedElementId === el.id ? "bg-blue-50 text-blue-700" : "hover:bg-neutral-100"}`}
													onClick={() =>
														setState((s: DesignerState) => ({ ...s, selectedElementId: el.id }))
													}
												>
													<span className="uppercase text-[10px] text-neutral-500 mr-2">{el.type}</span>
													<span className="truncate inline-block align-middle">{el.type === "text" ? (el as Extract<TemplateElement, { type: "text" }>).text ?? "Text" : el.id.slice(0, 6)}</span>
												</div>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem onClick={() => deleteElement(el.id)} variant="destructive">
													Delete
												</ContextMenuItem>
												<ContextMenuSeparator />
												<ContextMenuItem onClick={() => setState((s: DesignerState) => ({ ...s, selectedElementId: el.id }))}>Select</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>
									))}
								</div>
							</div>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel minSize={40}>
					<div className="h-full flex flex-col">
						<div className="px-3 py-2 border-b bg-white flex items-center gap-2">
							
							<Select
								value={currentTemplate?.id ?? ""}
								onValueChange={(id: string) =>
									setState((s: DesignerState) => ({
										...s,
										currentTemplateId: id,
									}))
								}
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
								</SelectContent>
							</Select>
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
						<div
							className="flex-1 overflow-auto bg-neutral-100 grid place-items-center"
							onDragOver={(e) => {
								e.preventDefault();
								console.log("[DND] container dragover");
							}}
							onDrop={(e) => {
								e.preventDefault();
								console.log("[DND] container drop (ignored)");
							}}
						>
							{!currentTemplate && (
								<div className="text-center text-neutral-500 p-8">
									<div className="text-sm mb-2">
										No template selected.
									</div>
									<div className="text-xs mb-4">
										Select an existing template from the
										dropdown above or create a new one to
										start designing.
									</div>
									<Button
										size="sm"
										onClick={() => createMutation.mutate()}
									>
										<Plus className="mr-1 h-4 w-4" /> Create
										template
									</Button>
								</div>
							)}
							<div
								ref={pageRef}
								className="bg-white shadow-xl relative"
								style={{
									width: 794 * state.zoom,
									height: 1123 * state.zoom,
								}}
								onDragOver={handleCanvasDragOver}
								onDrop={handleCanvasDrop}
							>
								{/* grid */}
								<div
									className="absolute inset-0 z-0"
									style={{
										backgroundSize: `${8 * state.zoom}px ${8 * state.zoom}px`,
										backgroundImage: `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)`,
									}}
									onDragEnter={() => {
										console.log("[DND] grid dragenter");
									}}
									onDragOver={handleCanvasDragOver}
									onDrop={handleCanvasDrop}
								/>
								{/* elements */}
								{(
									draftElements ??
									currentTemplate?.elements ??
									[]
								).map((el: TemplateElement) => (
									<div
										key={el.id}
										className={`absolute ${state.selectedElementId === el.id ? "ring-2 ring-blue-500" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"}`}
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
												mode: "move",
												startClientX: e.clientX,
												startClientY: e.clientY,
												startX: el.x,
												startY: el.y,
											});
										}}
									>
										{/* resize handles */}
										{state.selectedElementId === el.id && (
											<>
												{[
													{
														edge: "nw",
														cx: 0,
														cy: 0,
														cursor: "nwse-resize",
													},
													{
														edge: "n",
														cx: 0.5,
														cy: 0,
														cursor: "ns-resize",
													},
													{
														edge: "ne",
														cx: 1,
														cy: 0,
														cursor: "nesw-resize",
													},
													{
														edge: "e",
														cx: 1,
														cy: 0.5,
														cursor: "ew-resize",
													},
													{
														edge: "se",
														cx: 1,
														cy: 1,
														cursor: "nwse-resize",
													},
													{
														edge: "s",
														cx: 0.5,
														cy: 1,
														cursor: "ns-resize",
													},
													{
														edge: "sw",
														cx: 0,
														cy: 1,
														cursor: "nesw-resize",
													},
													{
														edge: "w",
														cx: 0,
														cy: 0.5,
														cursor: "ew-resize",
													},
												].map((h) => (
													<div
														key={h.edge}
														style={{
															position:
																"absolute",
															left: `calc(${h.cx * 100}% - 4px)`,
															top: `calc(${h.cy * 100}% - 4px)`,
															width: 8,
															height: 8,
															background: "white",
															border: "1px solid #2563eb",
															borderRadius: 2,
															cursor: h.cursor as React.CSSProperties["cursor"],
														}}
														onPointerDown={(e) => {
															e.preventDefault();
															e.stopPropagation();
															setDraftElements(
																(
																	currentTemplate?.elements ??
																	[]
																).map((x) => ({
																	...x,
																}))
															);
															setDrag({
																elementId:
																	el.id,
																mode: "resize",
																edge: h.edge as DragState["edge"],
																startClientX:
																	e.clientX,
																startClientY:
																	e.clientY,
																startX: el.x,
																startY: el.y,
																startWidth:
																	el.width,
																startHeight:
																	el.height,
															});
														}}
													/>
												))}
											</>
										)}
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
								{(() => {
									if (!state.selectedElementId) return null;
									const selectedEl = (
										draftElements ??
										currentTemplate?.elements ??
										[]
									).find(
										(e: TemplateElement) =>
											e.id === state.selectedElementId
									);
									if (!selectedEl) return null;
									return (
										<ElementProperties
											element={selectedEl}
											onChange={updateSelected}
										/>
									);
								})()}
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
	// Common position/size controls
	const common = (
		<div className="grid grid-cols-2 gap-2">
			<div className="space-y-1">
				<Label className="text-xs">X</Label>
				<Input
					type="number"
					value={element.x}
					onChange={(e) => onChange({ x: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Y</Label>
				<Input
					type="number"
					value={element.y}
					onChange={(e) => onChange({ y: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Width</Label>
				<Input
					type="number"
					value={element.width}
					onChange={(e) => onChange({ width: Number(e.target.value) })}
				/>
			</div>
			<div className="space-y-1">
				<Label className="text-xs">Height</Label>
				<Input
					type="number"
					value={element.height}
					onChange={(e) => onChange({ height: Number(e.target.value) })}
				/>
			</div>
		</div>
	);

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
						<>
							<div className="space-y-1">
								<Label className="text-xs">Text</Label>
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
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label className="text-xs">Font size</Label>
									<Input
									type="number"
									value={t.typography.fontSize}
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
											text: t.text,
											typography: { ...t.typography, fontSize: Number(e.target.value) },
											format: t.format,
										})
									}
									/>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Weight</Label>
									<Select
									value={t.typography.fontWeight}
									onValueChange={(v) =>
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
											text: t.text,
											typography: { ...t.typography, fontWeight: v as typeof t.typography.fontWeight },
											format: t.format,
										})
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="normal">Normal</SelectItem>
										<SelectItem value="medium">Medium</SelectItem>
										<SelectItem value="semibold">Semibold</SelectItem>
										<SelectItem value="bold">Bold</SelectItem>
									</SelectContent>
								</Select>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Color</Label>
									<Input
									placeholder="#111827"
									value={t.typography.color}
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
											text: t.text,
											typography: { ...t.typography, color: e.target.value },
											format: t.format,
										})
									}
								/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div className="space-y-1">
									<Label className="text-xs">Alignment</Label>
									<Select
									value={t.typography.align}
									onValueChange={(v) =>
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
											text: t.text,
											typography: { ...t.typography, align: v as typeof t.typography.align },
											format: t.format,
										})
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="left">Left</SelectItem>
										<SelectItem value="center">Center</SelectItem>
										<SelectItem value="right">Right</SelectItem>
									</SelectContent>
								</Select>
								</div>
								<div className="space-y-1">
									<Label className="text-xs">Uppercase</Label>
									<Switch
									checked={t.typography.uppercase}
									onCheckedChange={(checked) =>
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
											text: t.text,
											typography: { ...t.typography, uppercase: checked, lowercase: checked ? false : t.typography.lowercase },
											format: t.format,
										})
									}
								/>
								</div>
							</div>
						</>
					);
				})()}
				{common}
			</div>
		);
	}

	if (element.type === "image") {
		return (
			<div className="space-y-2">
				<div className="text-xs font-medium">Image</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1 col-span-2">
						<Label className="text-xs">Image URL</Label>
						<Input
							placeholder="https://..."
							value={(element as Extract<TemplateElement, { type: "image" }>).src}
							onChange={(e) => {
								const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, src: e.target.value });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Object fit</Label>
						<Select
							value={(element as Extract<TemplateElement, { type: "image" }>).objectFit}
							onValueChange={(v) => {
								const img = element as Extract<TemplateElement, { type: "image" }>;
								onChange({ ...img, objectFit: v as Extract<TemplateElement, { type: "image" }>["objectFit"] });
							}}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="contain">Contain</SelectItem>
								<SelectItem value="cover">Cover</SelectItem>
								<SelectItem value="fill">Fill</SelectItem>
								<SelectItem value="none">None</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				{common}
			</div>
		);
	}

	if (element.type === "box") {
		return (
			<div className="space-y-2">
				<div className="text-xs font-medium">Box</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<Label className="text-xs">Fill</Label>
						<Input
							placeholder="#RRGGBB"
							value={(element as Extract<TemplateElement, { type: "box" }>).fill}
							onChange={(e) => {
								const bx = element as Extract<TemplateElement, { type: "box" }>;
								onChange({ ...bx, fill: e.target.value });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Stroke</Label>
						<Input
							placeholder="#RRGGBB"
							value={(element as Extract<TemplateElement, { type: "box" }>).stroke}
							onChange={(e) => {
								const bx = element as Extract<TemplateElement, { type: "box" }>;
								onChange({ ...bx, stroke: e.target.value });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Stroke width</Label>
						<Input
							type="number"
							placeholder="1"
							value={(element as Extract<TemplateElement, { type: "box" }>).strokeWidth}
							onChange={(e) => {
								const bx = element as Extract<TemplateElement, { type: "box" }>;
								onChange({ ...bx, strokeWidth: Number(e.target.value) });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Corner radius</Label>
						<Input
							type="number"
							placeholder="0"
							value={(element as Extract<TemplateElement, { type: "box" }>).radius}
							onChange={(e) => {
								const bx = element as Extract<TemplateElement, { type: "box" }>;
								onChange({ ...bx, radius: Number(e.target.value) });
							}}
						/>
					</div>
				</div>
				{common}
			</div>
		);
	}

	if (element.type === "line") {
		return (
			<div className="space-y-2">
				<div className="text-xs font-medium">Line</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<Label className="text-xs">Stroke</Label>
						<Input
							placeholder="#RRGGBB"
							value={(element as Extract<TemplateElement, { type: "line" }>).stroke}
							onChange={(e) => {
								const ln = element as Extract<TemplateElement, { type: "line" }>;
								onChange({ ...ln, stroke: e.target.value });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Stroke width</Label>
						<Input
							type="number"
							placeholder="1"
							value={(element as Extract<TemplateElement, { type: "line" }>).strokeWidth}
							onChange={(e) => {
								const ln = element as Extract<TemplateElement, { type: "line" }>;
								onChange({ ...ln, strokeWidth: Number(e.target.value) });
							}}
						/>
					</div>
				</div>
				{common}
			</div>
		);
	}

	if (element.type === "table") {
		return (
			<div className="space-y-2">
				<div className="text-xs font-medium">Table</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="space-y-1">
						<Label className="text-xs">Row height</Label>
						<Input
							type="number"
							placeholder="28"
							value={(element as Extract<TemplateElement, { type: "table" }>).rowHeight}
							onChange={(e) => {
								const tbl = element as Extract<TemplateElement, { type: "table" }>;
								onChange({ ...tbl, rowHeight: Number(e.target.value) });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Header height</Label>
						<Input
							type="number"
							placeholder="28"
							value={(element as Extract<TemplateElement, { type: "table" }>).headerHeight}
							onChange={(e) => {
								const tbl = element as Extract<TemplateElement, { type: "table" }>;
								onChange({ ...tbl, headerHeight: Number(e.target.value) });
							}}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Stripe rows</Label>
						<Switch
							checked={(element as Extract<TemplateElement, { type: "table" }>).stripe}
							onCheckedChange={(checked) => {
								const tbl = element as Extract<TemplateElement, { type: "table" }>;
								onChange({ ...tbl, stripe: checked });
							}}
						/>
					</div>
					<div className="space-y-1 col-span-2">
						<Label className="text-xs">Items binding</Label>
						<Input
							placeholder="invoice.items"
							value={(element as Extract<TemplateElement, { type: "table" }>).itemsBinding}
							onChange={(e) => {
								const tbl = element as Extract<TemplateElement, { type: "table" }>;
								onChange({ ...tbl, itemsBinding: e.target.value });
							}}
						/>
					</div>
				</div>
				{/* Future: columns editor and totals editor */}
				{common}
			</div>
		);
	}
	return (
		<div className="text-xs text-neutral-500">
			Select an element to edit.
		</div>
	);
}

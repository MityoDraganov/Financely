import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Upload, MousePointer2, Type as TypeIcon, ImageIcon, Table as TableIcon, Square, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TemplateData, TemplateElement } from "@/core";
import { templateService } from "@/services/template-service";

type DesignerState = {
  currentTemplateId?: string;
  selectedElementId?: string;
  zoom: number;
};

export default function TemplateDesignerPage() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DesignerState>({ zoom: 1 });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => templateService.listTemplates("demo-org"),
  });

  const currentTemplate = useMemo(() => {
    return templates.find((t: any) => t.id === state.currentTemplateId) ?? templates[0];
  }, [templates, state.currentTemplateId]);

  const saveMutation = useMutation({
    mutationFn: async (partial: Partial<TemplateData>) => {
      if (!currentTemplate) return;
      await templateService.updateDraft(currentTemplate.id, partial);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const empty: TemplateData = {
        orgId: "demo-org",
        name: "New Invoice Template",
        description: "",
        pageSize: "A4",
        brand: { fonts: ["Inter"], colors: { primary: "#111827", secondary: "#6b7280", accent: "#2563eb" }, margins: { top: 40, right: 40, bottom: 40, left: 40 } },
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

  function addElement(kind: TemplateElement["type"]) {
    if (!currentTemplate) return;
    const newElement: TemplateElement =
      kind === "text"
        ? { id: crypto.randomUUID(), type: "text", x: 60, y: 80, width: 200, height: 40, rotation: 0, zIndex: 1, visible: true, text: "Text", typography: { fontFamily: "Inter", fontSize: 12, fontWeight: "normal", lineHeight: 1.2, letterSpacing: 0, color: "#111827", align: "left", uppercase: false, lowercase: false }, format: { kind: "none" } }
        : kind === "image"
        ? { id: crypto.randomUUID(), type: "image", x: 60, y: 80, width: 120, height: 60, rotation: 0, zIndex: 1, visible: true, src: "", objectFit: "contain" }
        : kind === "table"
        ? { id: crypto.randomUUID(), type: "table", x: 60, y: 160, width: 420, height: 200, rotation: 0, zIndex: 1, visible: true, rowHeight: 28, headerHeight: 28, stripe: true, columns: [], itemsBinding: "invoice.items", totals: [] }
        : kind === "box"
        ? { id: crypto.randomUUID(), type: "box", x: 40, y: 40, width: 200, height: 80, rotation: 0, zIndex: 0, visible: true, fill: "#ffffff00", stroke: "#e5e7eb", strokeWidth: 1, radius: 0 }
        : { id: crypto.randomUUID(), type: "line", x: 40, y: 140, width: 200, height: 1, rotation: 0, zIndex: 0, visible: true, x2: 240, y2: 140, stroke: "#e5e7eb", strokeWidth: 1 };
    saveMutation.mutate({ elements: [...(currentTemplate?.elements ?? []), newElement] });
  }

  function updateSelected(partial: Partial<TemplateElement>) {
    if (!currentTemplate || !state.selectedElementId) return;
    const next = (currentTemplate.elements ?? []).map((el: TemplateElement) =>
      el.id === state.selectedElementId ? ({ ...el, ...partial } as TemplateElement) : el,
    );
    saveMutation.mutate({ elements: next });
  }

  return (
    <div className="flex h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={18} minSize={16}>
          <div className="h-full p-3 border-r bg-neutral-50">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Templates</div>
              <Button size="sm" onClick={() => createMutation.mutate()}>
                <Plus className="mr-1 h-4 w-4" /> New
              </Button>
            </div>
            <div className="space-y-2">
              {templates.map((t: any) => (
                <Card
                  key={t.id}
                  className={`p-3 cursor-pointer ${t.id === currentTemplate?.id ? "ring-2 ring-blue-500" : ""}`}
                  onClick={() => setState((s: DesignerState) => ({ ...s, currentTemplateId: t.id }))}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-neutral-500">{t.status}</div>
                </Card>
              ))}
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase text-neutral-500 mb-2">Palette</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => addElement("text")}> <TypeIcon className="h-4 w-4 mr-1"/> Text</Button>
                <Button variant="secondary" onClick={() => addElement("image")}> <ImageIcon className="h-4 w-4 mr-1"/> Image</Button>
                <Button variant="secondary" onClick={() => addElement("table")}> <TableIcon className="h-4 w-4 mr-1"/> Table</Button>
                <Button variant="secondary" onClick={() => addElement("box")}> <Square className="h-4 w-4 mr-1"/> Box</Button>
                <Button variant="secondary" onClick={() => addElement("line")}> <Minus className="h-4 w-4 mr-1"/> Line</Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle/>
        <ResizablePanel minSize={40}>
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b bg-white flex items-center gap-2">
              <Button variant="outline" size="sm"><MousePointer2 className="h-4 w-4 mr-1"/> Select</Button>
              <div className="ml-auto flex items-center gap-2">
                <Select value={String(state.zoom)} onValueChange={(v: string) => setState((s: DesignerState)=>({ ...s, zoom: Number(v) }))}>
                  <SelectTrigger className="w-24"><SelectValue placeholder="Zoom"/></SelectTrigger>
                  <SelectContent>
                    {[0.75, 1, 1.25, 1.5, 2].map((z)=> (
                      <SelectItem key={z} value={String(z)}>{Math.round(z*100)}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => publishMutation.mutate()}>
                  <Upload className="h-4 w-4 mr-1"/> Publish
                </Button>
                <Button size="sm" onClick={() => currentTemplate && saveMutation.mutate({})}>
                  <Save className="h-4 w-4 mr-1"/> Save
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-neutral-100 grid place-items-center">
              <div
                className="bg-white shadow-xl relative"
                style={{ width: 794 * state.zoom, height: 1123 * state.zoom }}
              >
                {/* grid */}
                <div className="absolute inset-0" style={{ backgroundSize: `${8*state.zoom}px ${8*state.zoom}px`, backgroundImage: `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)` }} />
                {/* elements */}
                {(currentTemplate?.elements ?? []).map((el: TemplateElement) => (
                  <div
                    key={el.id}
                    className={`absolute ${state.selectedElementId === el.id ? "ring-2 ring-blue-500" : ""}`}
                    style={{ left: el.x * state.zoom, top: el.y * state.zoom, width: el.width * state.zoom, height: el.height * state.zoom, transform: `rotate(${el.rotation}deg)` }}
                    onClick={() => setState((s: DesignerState) => ({ ...s, selectedElementId: el.id }))}
                  >
                    {el.type === "text" && (() => { const t = el as Extract<TemplateElement, { type: "text" }>; return (
                      <div className="p-1" style={{ fontFamily: t.typography.fontFamily, fontSize: t.typography.fontSize * state.zoom, fontWeight: t.typography.fontWeight, lineHeight: t.typography.lineHeight, letterSpacing: t.typography.letterSpacing, color: t.typography.color, textAlign: t.typography.align }}>
                        {t.text}
                      </div>
                    ); })()}
                    {el.type === "image" && (
                      <div className="w-full h-full bg-neutral-100 grid place-items-center text-neutral-400">Image</div>
                    )}
                    {el.type === "box" && (() => { const b = el as Extract<TemplateElement, { type: "box" }>; return (
                      <div className="w-full h-full" style={{ background: b.fill, border: `${b.strokeWidth}px solid ${b.stroke}`, borderRadius: b.radius }} />
                    ); })()}
                    {el.type === "line" && (() => { const ln = el as Extract<TemplateElement, { type: "line" }>; return (
                      <div className="absolute top-1/2 left-0 right-0 border-t" style={{ borderColor: ln.stroke, borderWidth: ln.strokeWidth }} />
                    ); })()}
                    {el.type === "table" && (
                      <div className="w-full h-full border border-neutral-200 text-[10px] text-neutral-600 grid place-items-center">Table</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle/>
        <ResizablePanel defaultSize={22} minSize={18}>
          <div className="h-full p-3 border-l bg-neutral-50 space-y-3">
            <div className="font-medium">Properties</div>
            {!currentTemplate && <div className="text-sm text-neutral-500">Create a template to begin.</div>}
            {currentTemplate && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Name</div>
                  <Input value={currentTemplate.name} onChange={(e: React.ChangeEvent<HTMLInputElement>)=> saveMutation.mutate({ name: e.target.value })} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Page Size</div>
                  <Select value={currentTemplate.pageSize} onValueChange={(v: string)=> saveMutation.mutate({ pageSize: v as TemplateData["pageSize"] })}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {state.selectedElementId && (
                  <ElementProperties
                    element={(currentTemplate.elements ?? []).find((e: TemplateElement)=> e.id === state.selectedElementId)!}
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

function ElementProperties({ element, onChange }: { element: TemplateElement; onChange: (partial: Partial<TemplateElement>) => void; }) {
  if (element.type === "text") {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium">Text</div>
        <Input value={(element as any).text ?? ""} onChange={(e)=> onChange({ ...(element as any), text: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={element.x} onChange={(e)=> onChange({ x: Number(e.target.value) })} />
          <Input type="number" value={element.y} onChange={(e)=> onChange({ y: Number(e.target.value) })} />
          <Input type="number" value={element.width} onChange={(e)=> onChange({ width: Number(e.target.value) })} />
          <Input type="number" value={element.height} onChange={(e)=> onChange({ height: Number(e.target.value) })} />
        </div>
      </div>
    );
  }
  return <div className="text-xs text-neutral-500">Select an element to edit.</div>;
}


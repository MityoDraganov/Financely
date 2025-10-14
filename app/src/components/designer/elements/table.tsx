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
import { TemplateElement } from "@/core";

interface TableElementProps {
	element: Extract<TemplateElement, { type: "table" }>;
	zoom: number;
	onHeaderChange: (columnId: string, header: string) => void;
}

export default function TableElement({ 
	element, 
	zoom, 
	onHeaderChange 
}: TableElementProps) {
	const tbl = element;
	
	return (
		<div className="w-full h-full border border-neutral-200 bg-white">
			<div
				style={{
					display: "grid",
					gridTemplateColumns: tbl.columns.length > 0 ? tbl.columns.map(c => `${c.width * zoom}px`).join(" ") : "1fr 1fr",
					height: tbl.headerHeight * zoom,
					borderBottom: "1px solid #e5e7eb",
				}}
			>
				{(tbl.columns.length > 0
					? tbl.columns
					: [
						{ id: "c1", header: "", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
						{ id: "c2", header: "", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
					]
				).map((c) => (
					<input
						key={c.id}
						value={c.header ?? ""}
						onChange={(e) => onHeaderChange(c.id, e.target.value)}
						className="border-r last:border-r-0 px-2 text-[10px]"
						style={{
							textAlign: c.align,
						}}
					/>
				))}
			</div>
			<div className="text-[10px] text-neutral-500 p-2">Edit headers above or use Properties to configure columns and rows.</div>
		</div>
	);
}

interface TablePropertiesProps {
	element: Extract<TemplateElement, { type: "table" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function TableProperties({ 
	element, 
	onChange, 
	isNarrow 
}: TablePropertiesProps) {
	const tbl = element;
	
	// Common position/size controls
	const common = (
		<div className={isNarrow ? "grid grid-cols-1 gap-2" : "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2"}>
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

	return (
		<div className="space-y-2">
			<div className="text-xs font-medium">Table</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1">
					<Label className="text-xs">Row height</Label>
					<Input
						type="number"
						placeholder="28"
						value={tbl.rowHeight}
						onChange={(e) => onChange({ ...tbl, rowHeight: Number(e.target.value) })}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Header height</Label>
					<Input
						type="number"
						placeholder="28"
						value={tbl.headerHeight}
						onChange={(e) => onChange({ ...tbl, headerHeight: Number(e.target.value) })}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Stripe rows</Label>
					<Switch
						checked={tbl.stripe}
						onCheckedChange={(checked) => onChange({ ...tbl, stripe: checked })}
					/>
				</div>
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Items binding</Label>
					<Input
						placeholder=""
						value={tbl.itemsBinding}
						onChange={(e) => onChange({ ...tbl, itemsBinding: e.target.value })}
					/>
				</div>
			</div>

			<div className="space-y-1">
				<div className="text-xs text-neutral-500">Columns</div>
				<div className="space-y-2">
					{(() => {
						const defaultTwo = [
							{ id: "c1", header: "Column 1", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
							{ id: "c2", header: "Column 2", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
						];
						const derivedColumns = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
						return derivedColumns.map((c) => (
							<div key={c.id} className="space-y-2">
								<div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 items-start min-w-0">
									<Input
										className="min-w-0 w-full"
										placeholder="Header"
										value={c.header}
										onChange={(e) => {
											const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
											const next = base.map((col) => col.id === c.id ? { ...col, header: e.target.value } : col);
											onChange({ ...tbl, columns: next });
										}}
									/>
									<Input
										type="number"
										placeholder="Width"
										value={c.width}
										className="min-w-0 w-full"
										onChange={(e) => {
											const w = Math.max(20, Number(e.target.value));
											const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
											const next = base.map((col) => (col.id === c.id ? { ...col, width: w } : col));
											onChange({ ...tbl, columns: next });
										}}
									/>
									<Select
										value={c.align}
										onValueChange={(v) => {
											const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
											const next = base.map((col) => (col.id === c.id ? { ...col, align: v as typeof c.align } : col));
											onChange({ ...tbl, columns: next });
										}}
									>
										<SelectTrigger className="min-w-0 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="left">Left</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="right">Right</SelectItem>
										</SelectContent>
									</Select>
									<Select
										value={c.type ?? "text"}
										onValueChange={(v) => {
											const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
											const next = base.map((col) => (col.id === c.id ? { ...col, type: v as "text" | "number" | "date" } : col));
											onChange({ ...tbl, columns: next });
										}}
									>
										<SelectTrigger className="min-w-0 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="text">Text</SelectItem>
											<SelectItem value="number">Number</SelectItem>
											<SelectItem value="date">Date</SelectItem>
										</SelectContent>
									</Select>
									<Button
										variant="ghost"
										size="sm"
										className="justify-self-start"
										onClick={() => {
											const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
											const next = base.filter((col) => col.id !== c.id);
											onChange({ ...tbl, columns: next });
										}}
									>
										Remove
									</Button>
								</div>
								<div className="h-px bg-border" />
							</div>
						));
					})()}
					<Button
						variant="secondary"
						size="sm"
						onClick={() => {
							const next = [
								...tbl.columns,
								{ id: crypto.randomUUID(), header: `Column ${tbl.columns.length + 1}`, width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
							];
							onChange({ ...tbl, columns: next });
						}}
					>
						Add column
					</Button>
				</div>
			</div>

			{common}
		</div>
	);
}
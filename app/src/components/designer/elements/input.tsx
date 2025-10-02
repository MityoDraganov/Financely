import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TemplateElement } from "@/core";

interface InputElementProps {
	element: Extract<TemplateElement, { type: "input" }>;
}

export default function InputElement({ element }: InputElementProps) {
	const inp = element;
	
	return (
		<div className="w-full h-full grid place-items-center text-neutral-400">
			<input
				type={inp.variant}
				placeholder={inp.placeholder}
				className="w-[95%] h-[80%] border border-neutral-200 rounded px-2 text-[10px] bg-white"
				style={{ textAlign: inp.align as React.CSSProperties["textAlign"] }}
				readOnly
			/>
		</div>
	);
}

interface InputPropertiesProps {
	element: Extract<TemplateElement, { type: "input" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function InputProperties({ element, onChange, isNarrow }: InputPropertiesProps) {
	const inp = element;
	
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
			<div className="text-xs font-medium">Input</div>
			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Placeholder</Label>
					<Input
						placeholder="Placeholder"
						value={inp.placeholder}
						onChange={(e) =>
							onChange({
								id: element.id,
								type: "input",
								x: element.x,
								y: element.y,
								width: element.width,
								height: element.height,
								rotation: element.rotation,
								zIndex: element.zIndex,
								visible: element.visible,
								placeholder: e.target.value,
								variant: inp.variant,
								align: inp.align,
								binding: inp.binding,
							})
						}
					/>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Variant</Label>
					<Select
						value={inp.variant}
						onValueChange={(v) =>
							onChange({
								id: element.id,
								type: "input",
								x: element.x,
								y: element.y,
								width: element.width,
								height: element.height,
								rotation: element.rotation,
								zIndex: element.zIndex,
								visible: element.visible,
								placeholder: inp.placeholder,
								variant: v as typeof inp.variant,
								align: inp.align,
								binding: inp.binding,
							})
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="text">Text</SelectItem>
							<SelectItem value="number">Number</SelectItem>
							<SelectItem value="date">Date</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1">
					<Label className="text-xs">Align</Label>
					<Select
						value={inp.align}
						onValueChange={(v) =>
							onChange({
								id: element.id,
								type: "input",
								x: element.x,
								y: element.y,
								width: element.width,
								height: element.height,
								rotation: element.rotation,
								zIndex: element.zIndex,
								visible: element.visible,
								placeholder: inp.placeholder,
								variant: inp.variant,
								align: v as typeof inp.align,
								binding: inp.binding,
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
				<div className="space-y-1 col-span-2">
					<Label className="text-xs">Binding</Label>
					<Input
						placeholder="invoice.customerName"
						value={inp.binding ?? ""}
						onChange={(e) =>
							onChange({
								id: element.id,
								type: "input",
								x: element.x,
								y: element.y,
								width: element.width,
								height: element.height,
								rotation: element.rotation,
								zIndex: element.zIndex,
								visible: element.visible,
								placeholder: inp.placeholder,
								variant: inp.variant,
								align: inp.align,
								binding: e.target.value,
							})
						}
					/>
				</div>
			</div>
			{common}
		</div>
	);
}

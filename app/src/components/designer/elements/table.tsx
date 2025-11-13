import { useState, useEffect } from "react";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { TemplateElement } from "@/core";
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { CURRENCIES, getCurrency } from "@/utils/currencies";
import { cn } from "@/lib/utils";
import { CurrencyFieldLinking } from "../currency-field-linking";

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
	allElements?: TemplateElement[];
}

export function TableProperties({ 
	element, 
	onChange, 
	isNarrow,
	allElements = []
}: TablePropertiesProps) {
	const tbl = element;
	const [bindingInput, setBindingInput] = useState(tbl.itemsBinding ?? "");
	
	// Check for duplicate bindings
	const hasDuplicateBinding = (binding: string | undefined): boolean => {
		if (!binding) return false;
		return allElements.some((el) => {
			if (el.id === element.id) return false; // Don't check against self
			if (el.type === "text" || el.type === "input" || el.type === "image") {
				return el.binding === binding;
			}
			if (el.type === "table") {
				return el.itemsBinding === binding;
			}
			return false;
		});
	};
	
	// Generate a unique binding suggestion
	const getUniqueBinding = (binding: string): string => {
		if (!binding) return "";
		let counter = 1;
		let suggested = binding;
		while (hasDuplicateBinding(suggested)) {
			suggested = `${binding} (${counter})`;
			counter++;
		}
		return suggested;
	};
	
	const bindingError = hasDuplicateBinding(bindingInput);
	const suggestedBinding = bindingError ? getUniqueBinding(bindingInput) : null;
	
	// Sync with element binding when it changes externally
	useEffect(() => {
		setBindingInput(tbl.itemsBinding ?? "");
	}, [tbl.itemsBinding]);
	
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
					<div className="space-y-1.5">
					<Input
						placeholder=""
							value={bindingInput}
							className={bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}
							onChange={(e) => {
								const newValue = e.target.value;
								setBindingInput(newValue);
								// Update immediately, but show warning if duplicate
								onChange({ ...tbl, itemsBinding: newValue || undefined });
							}}
						/>
						{bindingError && suggestedBinding && (
							<div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
								<AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="text-xs font-medium text-amber-800 mb-1">
										This binding is already used by another element
									</p>
									<div className="flex items-center gap-2">
										<p className="text-xs text-amber-700 flex-1 truncate">
											Suggested: <span className="font-mono font-medium">{suggestedBinding}</span>
										</p>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="h-6 px-2 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
											onClick={() => {
												setBindingInput(suggestedBinding);
												onChange({ ...tbl, itemsBinding: suggestedBinding });
											}}
										>
											<Check className="h-3 w-3 mr-1" />
											Use
										</Button>
									</div>
								</div>
							</div>
						)}
					</div>
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
											const newType = v as "text" | "number" | "date" | "currency";
											const updatedCol = { ...c, type: newType };
											
											// Initialize currency fields when switching to currency type
											if (newType === "currency" && !updatedCol.currency) {
												updatedCol.currency = "USD";
												updatedCol.mode = "independent";
												updatedCol.currencyLinks = [];
											}
											
											const next = base.map((col) => (col.id === c.id ? updatedCol : col));
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
											<SelectItem value="currency">Currency</SelectItem>
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
								
								{/* Currency-specific configuration */}
								{c.type === "currency" && (
									<div className="space-y-2 pt-2 pl-2 border-l-2 border-blue-200 bg-blue-50/30 rounded">
										<div className="text-xs font-medium text-blue-900">Currency Configuration</div>
										<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
											<div className="space-y-1 col-span-2">
												<Label className="text-xs">Currency</Label>
												<Popover>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															role="combobox"
															className="w-full justify-between h-9 text-xs"
														>
															{c.currency
																? (() => {
																		const curr = getCurrency(c.currency || "USD");
																		return curr
																			? `${curr.code} - ${curr.name}${curr.symbol ? ` (${curr.symbol})` : ""}`
																			: c.currency;
																	})()
																: "Select currency..."}
															<ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent className="w-[300px] p-0" align="start">
														<Command>
															<CommandInput placeholder="Search currency..." />
															<CommandList>
																<CommandEmpty>No currency found.</CommandEmpty>
																<CommandGroup>
																	{CURRENCIES.map((curr) => (
																		<CommandItem
																			key={curr.code}
																			value={`${curr.code} ${curr.name} ${curr.symbol || ""}`}
																			onSelect={() => {
																				const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																				const next = base.map((col) => 
																					col.id === c.id 
																						? { ...col, currency: curr.code }
																						: col
																				);
																				onChange({ ...tbl, columns: next });
																			}}
																			className="text-xs cursor-pointer"
																		>
																			<Check
																				className={cn(
																					"mr-2 h-3 w-3",
																					c.currency === curr.code
																						? "opacity-100"
																						: "opacity-0"
																				)}
																			/>
																			<span className="font-medium">{curr.code}</span>
																			<span className="ml-2 text-neutral-500">
																				- {curr.name}
																			</span>
																			{curr.symbol && (
																				<span className="ml-1 text-neutral-400">
																					({curr.symbol})
																				</span>
																			)}
																		</CommandItem>
																	))}
																</CommandGroup>
															</CommandList>
														</Command>
													</PopoverContent>
												</Popover>
											</div>
											
											<div className="space-y-1">
												<Label className="text-xs">Mode</Label>
												<Select
													value={c.mode || "independent"}
													onValueChange={(v) => {
														const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
														const next = base.map((col) => 
															col.id === c.id 
																? { ...col, mode: v as "independent" | "linked" | "formula" }
																: col
														);
														onChange({ ...tbl, columns: next });
													}}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="independent">Independent</SelectItem>
														<SelectItem value="linked">Linked</SelectItem>
														<SelectItem value="formula" disabled>Formula (Coming Soon)</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										
										{/* Field Linking UI for currency columns */}
										{c.mode === "linked" && (
											<div className="pt-2">
												{(() => {
													// Only show other currency columns from the same table as available fields
													const sameTableCurrencyColumns = (tbl.columns || defaultTwo)
														.filter((col) => col.id !== c.id && col.type === "currency")
														.map((col) => ({
															...col,
															id: col.id,
															type: "currency" as const,
															x: 0,
															y: 0,
															width: 0,
															height: 0,
															rotation: 0,
															zIndex: 0,
															visible: true,
															placeholder: "",
															currency: col.currency || "USD",
															currencyLinks: col.currencyLinks || [],
															mode: col.mode || "independent",
															align: col.align,
															binding: col.binding,
														}));
													
													return (
														<CurrencyFieldLinking
															currentField={{
																...c,
																id: c.id,
																type: "currency" as const,
																x: 0,
																y: 0,
																width: 0,
																height: 0,
																rotation: 0,
																zIndex: 0,
																visible: true,
																placeholder: "",
																currency: c.currency || "USD",
																currencyLinks: c.currencyLinks || [],
																mode: c.mode || "independent",
																align: c.align,
																binding: c.binding,
															}}
															allFields={sameTableCurrencyColumns}
															onLinkChange={(links) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { ...col, currencyLinks: links }
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
														/>
													);
												})()}
											</div>
										)}
									</div>
								)}
								
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
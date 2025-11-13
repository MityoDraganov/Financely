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
import { FormulaBuilder } from "../formula-builder";
import { typography, spacing, separators, components, colors } from "../design-system";

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
	
	// Default columns for fallback
	const defaultTwo = [
		{ id: "c1", header: "Column 1", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
		{ id: "c2", header: "Column 2", width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
	];
	
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
		<section className={`${components.section} ${separators.subsectionDivider}`}>
			<h4 className={typography.subsectionTitle}>Position & Size</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>X</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Y</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Width</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>Height</Label>
					<Input
						type="number"
						value={element.height}
						onChange={(e) => onChange({ height: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
			</div>
		</section>
	);

	return (
		<div className={components.section}>
			<h3 className={typography.sectionTitle}>Table</h3>
			
			{/* Table Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>Settings</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Row Height</Label>
						<Input
							type="number"
							placeholder="28"
							value={tbl.rowHeight}
							onChange={(e) => onChange({ ...tbl, rowHeight: Number(e.target.value) })}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Header Height</Label>
						<Input
							type="number"
							placeholder="28"
							value={tbl.headerHeight}
							onChange={(e) => onChange({ ...tbl, headerHeight: Number(e.target.value) })}
							className={components.inputHeight}
						/>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>Stripe Rows</Label>
						<div className="flex items-center h-9">
							<Switch
								checked={tbl.stripe}
								onCheckedChange={(checked) => onChange({ ...tbl, stripe: checked })}
							/>
						</div>
					</div>
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>Items Binding</Label>
						<div className={spacing.fieldGroupGap}>
							<Input
								placeholder="e.g., items"
								value={bindingInput}
								className={`${components.inputHeight} ${bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
								onChange={(e) => {
									const newValue = e.target.value;
									setBindingInput(newValue);
									onChange({ ...tbl, itemsBinding: newValue || undefined });
								}}
							/>
							{bindingError && suggestedBinding && (
								<div className={`flex items-start gap-2 p-2.5 ${colors.bgWarning} border ${colors.borderDefault} rounded-md`}>
									<AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className={`${typography.errorText} mb-1.5`}>
											This binding is already used by another element
										</p>
										<div className="flex items-center gap-2">
											<p className={`${typography.errorTextSecondary} flex-1 truncate`}>
												Suggested: <span className="font-mono font-medium">{suggestedBinding}</span>
											</p>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 px-2.5 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
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
			</section>

			{/* Columns Configuration */}
			<section className={`${components.subsection} ${separators.subsectionDivider}`}>
				<h4 className={typography.subsectionTitle}>Columns</h4>
				<div className={spacing.fieldGroupGap}>
					{(() => {
						const derivedColumns = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
						return derivedColumns.map((c) => (
							<div key={c.id} className={`${components.card} ${spacing.fieldGroupGap}`}>
								{/* Column Basic Settings */}
								<div className={components.grid}>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>Header</Label>
										<Input
											placeholder="Column header"
											value={c.header}
											onChange={(e) => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
												const next = base.map((col) => col.id === c.id ? { ...col, header: e.target.value } : col);
												onChange({ ...tbl, columns: next });
											}}
											className={components.inputHeight}
										/>
									</div>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>Width</Label>
										<Input
											type="number"
											placeholder="120"
											value={c.width}
											onChange={(e) => {
												const w = Math.max(20, Number(e.target.value));
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
												const next = base.map((col) => (col.id === c.id ? { ...col, width: w } : col));
												onChange({ ...tbl, columns: next });
											}}
											className={components.inputHeight}
										/>
									</div>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>Align</Label>
										<Select
											value={c.align}
											onValueChange={(v) => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo.map(d => ({ ...d, type: 'text' as const }));
												const next = base.map((col) => (col.id === c.id ? { ...col, align: v as typeof c.align } : col));
												onChange({ ...tbl, columns: next });
											}}
										>
											<SelectTrigger className={components.inputHeight}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="left">Left</SelectItem>
												<SelectItem value="center">Center</SelectItem>
												<SelectItem value="right">Right</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>Type</Label>
										<Select
											value={c.type ?? "text"}
											onValueChange={(v) => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
												const newType = v as "text" | "number" | "date" | "currency";
												
												// Initialize currency fields when switching to currency type
												if (newType === "currency") {
													const updatedCol = {
														...c,
														type: "currency" as const,
														currency: (c.type === "currency" ? c.currency : undefined) || "USD",
														mode: (c.type === "currency" ? c.mode : undefined) || "independent" as const,
														currencyLinks: (c.type === "currency" ? c.currencyLinks : undefined) || [],
													};
													const next = base.map((col) => (col.id === c.id ? updatedCol : col));
													onChange({ ...tbl, columns: next });
												} else {
													const updatedCol = { ...c, type: newType };
													const next = base.map((col) => (col.id === c.id ? updatedCol : col));
													onChange({ ...tbl, columns: next });
												}
											}}
										>
											<SelectTrigger className={components.inputHeight}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="text">Text</SelectItem>
												<SelectItem value="number">Number</SelectItem>
												<SelectItem value="date">Date</SelectItem>
												<SelectItem value="currency">Currency</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className={`${components.field} flex items-end`}>
										<Button
											variant="ghost"
											size="sm"
											className="h-9 text-xs"
											onClick={() => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
												const next = base.filter((col) => col.id !== c.id);
												onChange({ ...tbl, columns: next });
											}}
										>
											Remove
										</Button>
									</div>
								</div>
								
								{/* Currency-specific configuration */}
								{c.type === "currency" && (
									<div className={`${separators.nestedContent} ${colors.bgAccent} rounded-md p-3 ${spacing.fieldGroupGap}`}>
										<h5 className={`${typography.subsectionTitle} text-blue-700`}>Currency</h5>
										<div className={components.grid}>
											<div className={`${components.field} col-span-full`}>
												<Label className={typography.fieldLabel}>Currency</Label>
												<Popover>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															role="combobox"
															className={`w-full justify-between ${components.inputHeight} text-xs`}
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
														<SelectItem value="formula">Formula</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
										
										{/* Field Linking UI for currency columns */}
										{c.mode === "linked" && (
											<div className={`${separators.subsectionDivider} pt-3`}>
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
										
										{/* Formula Builder for currency columns */}
										{c.mode === "formula" && (
											<div className={`${separators.subsectionDivider} pt-3`}>
												<FormulaBuilder
													formula={c.calc}
													onChange={(formula) => {
														const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
														const next = base.map((col) => 
															col.id === c.id 
																? { ...col, calc: formula }
																: col
														);
														onChange({ ...tbl, columns: next });
													}}
													currentElement={element}
													allElements={allElements}
													tableContext={{
														tableElement: element,
														columnId: c.id,
													}}
												/>
											</div>
										)}
									</div>
								)}
								
								{/* Formula Builder for number columns */}
								{c.type === "number" && (
									<div className={`${separators.subsectionDivider} pt-3`}>
										<FormulaBuilder
											formula={c.calc}
											onChange={(formula) => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
												const next = base.map((col) => 
													col.id === c.id 
														? { ...col, calc: formula }
														: col
												);
												onChange({ ...tbl, columns: next });
											}}
											currentElement={element}
											allElements={allElements}
											tableContext={{
												tableElement: element,
												columnId: c.id,
											}}
										/>
									</div>
								)}
								
								{/* Formula Builder for currency columns (when not in formula mode) */}
								{c.type === "currency" && c.mode !== "formula" && (
									<div className={`${separators.subsectionDivider} pt-3`}>
										<FormulaBuilder
											formula={c.calc}
											onChange={(formula) => {
												const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
												const next = base.map((col) => 
													col.id === c.id 
														? { ...col, calc: formula }
														: col
												);
												onChange({ ...tbl, columns: next });
											}}
											currentElement={element}
											allElements={allElements}
											tableContext={{
												tableElement: element,
												columnId: c.id,
											}}
										/>
									</div>
								)}
								
								{/* Total Row Configuration (only for number/currency columns) */}
								{(c.type === "number" || c.type === "currency") && (
									<div className={`${separators.subsectionDivider} pt-3 ${spacing.fieldGroupGap}`}>
										<div className="flex items-center justify-between">
											<Label className={typography.fieldLabel}>Show Total</Label>
											<Switch
												checked={c.showTotal || false}
												onCheckedChange={(checked) => {
													const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
													const next = base.map((col) => 
														col.id === c.id 
															? { 
																...col, 
																showTotal: checked,
																totalStyle: checked && !("totalStyle" in col && col.totalStyle) ? {
																	backgroundColor: "#f9fafb",
																	fontWeight: "bold" as const,
																	borderTop: "2px solid #111827",
																} : ("totalStyle" in col && col.totalStyle ? col.totalStyle : undefined)
															}
															: col
													);
													onChange({ ...tbl, columns: next });
												}}
											/>
										</div>
										
										{c.showTotal && (
											<div className={`${separators.nestedContent} ${colors.bgSuccess} rounded-md p-3 ${spacing.fieldGroupGap}`}>
												<h5 className={`${typography.subsectionTitle} text-green-700`}>Total Styling</h5>
												<div className={components.grid}>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>Background Color</Label>
														<Input
															type="color"
															value={("totalStyle" in c && c.totalStyle?.backgroundColor) || "#f9fafb"}
															onChange={(e) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { 
																			...col, 
																			totalStyle: {
																				fontWeight: ("totalStyle" in col && col.totalStyle?.fontWeight) || "bold",
																				...("totalStyle" in col ? col.totalStyle : {}),
																				backgroundColor: e.target.value,
																			}
																		}
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
															className={components.inputHeightSmall}
														/>
													</div>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>Text Color</Label>
														<Input
															type="color"
															value={("totalStyle" in c && c.totalStyle?.color) || "#111827"}
															onChange={(e) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { 
																			...col, 
																			totalStyle: {
																				fontWeight: ("totalStyle" in col && col.totalStyle?.fontWeight) || "bold",
																				...("totalStyle" in col ? col.totalStyle : {}),
																				color: e.target.value,
																			}
																		}
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
															className={components.inputHeightSmall}
														/>
													</div>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>Font Weight</Label>
														<Select
															value={("totalStyle" in c && c.totalStyle?.fontWeight) || "bold"}
															onValueChange={(v) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { 
																			...col, 
																			totalStyle: {
																				...("totalStyle" in col ? col.totalStyle : {}),
																				fontWeight: v as "normal" | "bold" | "600" | "700",
																			}
																		}
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
														>
															<SelectTrigger className={components.inputHeightSmall}>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="normal">Normal</SelectItem>
																<SelectItem value="600">Semi-bold</SelectItem>
																<SelectItem value="bold">Bold</SelectItem>
																<SelectItem value="700">Extra Bold</SelectItem>
															</SelectContent>
														</Select>
													</div>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>Font Size</Label>
														<Input
															type="number"
															placeholder="Auto"
															value={("totalStyle" in c && c.totalStyle?.fontSize) || ""}
															onChange={(e) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { 
																			...col, 
																			totalStyle: {
																				fontWeight: ("totalStyle" in col && col.totalStyle?.fontWeight) || "bold",
																				...("totalStyle" in col ? col.totalStyle : {}),
																				fontSize: e.target.value ? Number(e.target.value) : undefined,
																			}
																		}
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
															className={`${components.inputHeightSmall} text-xs`}
														/>
													</div>
													<div className={`${components.field} col-span-full`}>
														<Label className={typography.fieldLabel}>Top Border</Label>
														<Input
															placeholder="e.g., 2px solid #111827"
															value={("totalStyle" in c && c.totalStyle?.borderTop) || "2px solid #111827"}
															onChange={(e) => {
																const base = (tbl.columns && tbl.columns.length > 0) ? tbl.columns : defaultTwo;
																const next = base.map((col) => 
																	col.id === c.id 
																		? { 
																			...col, 
																			totalStyle: {
																				fontWeight: ("totalStyle" in col && col.totalStyle?.fontWeight) || "bold",
																				...("totalStyle" in col ? col.totalStyle : {}),
																				borderTop: e.target.value,
																			}
																		}
																		: col
																);
																onChange({ ...tbl, columns: next });
															}}
															className={`${components.inputHeightSmall} text-xs`}
														/>
													</div>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						));
					})()}
					<Button
						variant="secondary"
						size="sm"
						className={`${components.inputHeight} text-xs`}
						onClick={() => {
							const next = [
								...tbl.columns,
								{ id: crypto.randomUUID(), header: `Column ${tbl.columns.length + 1}`, width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
							];
							onChange({ ...tbl, columns: next });
						}}
					>
						Add Column
					</Button>
				</div>
			</section>

			{common}
		</div>
	);
}
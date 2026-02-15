import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import {
	clampPercentageColumnWidth,
	formatTableColumnWidth,
	getEditableTableColumnWidth,
	getTableGridTemplateColumns,
	getTablePercentageWidthSum,
	type TableColumnWidthUnit,
} from "@/utils/table-column-width";
import {
	getTableTextBehaviorStyles,
	normalizeTableTextBehavior,
	type TableTextBehavior,
	type TableTextBehaviorMode,
} from "@/utils/table-text-behavior";
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
	const { t } = useTranslation();
	const tbl = element;
	const headerTextBehavior = normalizeTableTextBehavior(tbl.headerStyle?.textBehavior, "wrap");
	const rowTextBehavior = normalizeTableTextBehavior(tbl.rowStyle?.textBehavior, "wrap");
	const headerTextStyle = getTableTextBehaviorStyles(headerTextBehavior);
	const rowTextStyle = getTableTextBehaviorStyles(
		rowTextBehavior
	);
	const headerIsMultiline = ["wrap", "break-words", "clamp"].includes(headerTextBehavior.mode);
	const rowIsMultiline = ["wrap", "break-words", "clamp"].includes(rowTextBehavior.mode);
	const rowOverflowVisible = ["wrap", "break-words"].includes(rowTextBehavior.mode);
	const previewColumns = tbl.columns.length > 0
		? tbl.columns
		: [
			{ id: "c1", header: "", width: "1fr", align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
			{ id: "c2", header: "", width: "1fr", align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
		];
	
	return (
		<div className="w-full h-full border border-border bg-background">
			{/* Header */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: getTableGridTemplateColumns(previewColumns),
					minHeight: tbl.headerHeight * zoom,
					borderBottom: "1px solid hsl(var(--border))",
				}}
			>
				{previewColumns.map((c) => (
						<div
							key={c.id}
							className="border-r last:border-r-0 px-2 text-[10px] bg-background text-foreground border-border min-w-0 flex"
						style={{
							textAlign: c.align,
							alignItems: headerIsMultiline ? "flex-start" : "center",
						}}
					>
						<textarea
							value={c.header ?? ""}
							onChange={(e) => onHeaderChange(c.id, e.target.value)}
							className="w-full bg-transparent border-0 outline-none resize-none p-0"
							rows={headerTextBehavior.mode === "clamp" ? headerTextBehavior.clampLines ?? 2 : 2}
							style={{
								...headerTextStyle,
								textAlign: c.align,
								height: "100%",
								fontSize: "10px",
							}}
						/>
					</div>
				))}
			</div>
			{/* Preview row - show first row for design preview */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: getTableGridTemplateColumns(previewColumns),
					minHeight: tbl.rowHeight * zoom,
					borderBottom: "1px solid hsl(var(--border))",
				}}
			>
				{previewColumns.map((c) => (
					<div
						key={c.id}
						className="border-r last:border-r-0 px-2 text-[10px] text-muted-foreground flex items-center min-w-0"
						style={{
							textAlign: c.align,
							justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start",
							alignItems: rowIsMultiline ? "flex-start" : "center",
							overflow: rowOverflowVisible ? "visible" : "hidden",
						}}
					>
						<span style={rowTextStyle}>
							{c.type === "currency"
								? "$1,234.56"
								: c.type === "number"
									? "12345"
									: c.type === "date"
										? "2024-01-01"
										: "Sample value that can wrap"}
						</span>
					</div>
				))}
			</div>
			<div className="text-[10px] text-muted-foreground p-2">{t('designer.elementProperties.table.editHeadersHint')}</div>
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
	const { t } = useTranslation();
	const tbl = element;
	const [bindingInput, setBindingInput] = useState(tbl.itemsBinding ?? "");
	
	// Default columns for fallback
	const defaultTwo = [
		{ id: "c1", header: t('designer.tableColumns.column1'), width: "50%", align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
		{ id: "c2", header: t('designer.tableColumns.column2'), width: "50%", align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
	];

	const getBaseColumns = () => (tbl.columns && tbl.columns.length > 0)
		? tbl.columns
		: defaultTwo.map((column) => ({ ...column, type: "text" as const }));

	const setColumnWidth = (columnId: string, value: number, unit: TableColumnWidthUnit) => {
		const base = getBaseColumns();
		const safeValue = unit === "%"
			? clampPercentageColumnWidth(value, base, columnId)
			: Math.max(0.1, Number.isFinite(value) ? value : 0.1);
		const next = base.map((column) =>
			column.id === columnId
				? {
						...column,
						width: formatTableColumnWidth({ value: safeValue, unit }),
					}
				: column
		);
		onChange({ ...tbl, columns: next });
	};

	const setColumnWidthUnit = (columnId: string, unit: TableColumnWidthUnit) => {
		const base = getBaseColumns();
		const target = base.find((column) => column.id === columnId);
		if (!target) return;
		const current = getEditableTableColumnWidth(target.width);
		setColumnWidth(columnId, current.value, unit);
	};

	const headerTextBehavior = normalizeTableTextBehavior(tbl.headerStyle?.textBehavior, "wrap");
	const rowTextBehavior = normalizeTableTextBehavior(tbl.rowStyle?.textBehavior, "wrap");

	const updateHeaderTextBehavior = (next: TableTextBehavior) => {
		onChange({
			...tbl,
			headerStyle: {
				...(tbl.headerStyle ?? {}),
				textBehavior: next,
			},
		});
	};

	const updateRowTextBehavior = (next: TableTextBehavior) => {
		onChange({
			...tbl,
			rowStyle: {
				...(tbl.rowStyle ?? {}),
				textBehavior: next,
			},
		});
	};
	
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
			<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.common.positionAndSize')}</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.x')}</Label>
				<Input
					type="number"
					value={element.x}
					onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
				/>
			</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.y')}</Label>
				<Input
					type="number"
					value={element.y}
					onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
				/>
			</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.width')}</Label>
				<Input
					type="number"
					value={element.width}
					onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
				/>
			</div>
				{/* Height is calculated dynamically: headerHeight + rowHeight * items.length */}
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t('designer.elementProperties.common.height')}</Label>
					<div className={`${components.inputHeight} flex items-center text-muted-foreground text-xs`}>
						{t('designer.elementProperties.table.heightCalculated')} ({element.headerHeight} + {element.rowHeight} × items)
					</div>
				</div>
		</div>
		</section>
	);

	const derivedColumns = getBaseColumns();
	const percentWidthTotal = getTablePercentageWidthSum(derivedColumns);

	return (
		<div className={components.section}>
			<h3 className={typography.sectionTitle}>{t('designer.elementProperties.table.title')}</h3>
			
			{/* Table Settings */}
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.table.settings')}</h4>
				<div className={components.grid}>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.rowHeight')}</Label>
					<Input
						type="number"
						placeholder="28"
						value={tbl.rowHeight}
						onChange={(e) => onChange({ ...tbl, rowHeight: Number(e.target.value) })}
							className={components.inputHeight}
					/>
				</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.headerHeight')}</Label>
					<Input
						type="number"
						placeholder="28"
						value={tbl.headerHeight}
						onChange={(e) => onChange({ ...tbl, headerHeight: Number(e.target.value) })}
							className={components.inputHeight}
					/>
				</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.stripeRows')}</Label>
						<div className="flex items-center h-9">
					<Switch
						checked={tbl.stripe}
						onCheckedChange={(checked) => onChange({ ...tbl, stripe: checked })}
					/>
				</div>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>
							{t("designer.elementProperties.table.headerTextBehavior", "Header Text Behavior")}
						</Label>
						<Select
							value={headerTextBehavior.mode}
							onValueChange={(mode) => {
								const nextMode = mode as TableTextBehaviorMode;
								updateHeaderTextBehavior(
									nextMode === "clamp"
										? { mode: nextMode, clampLines: headerTextBehavior.clampLines ?? 2 }
										: { mode: nextMode }
								);
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="wrap">{t("designer.elementProperties.table.textModes.wrap", "Wrap (Normal)")}</SelectItem>
								<SelectItem value="nowrap">{t("designer.elementProperties.table.textModes.nowrap", "No Wrap")}</SelectItem>
								<SelectItem value="break-words">{t("designer.elementProperties.table.textModes.breakWords", "Break Words")}</SelectItem>
								<SelectItem value="ellipsis">{t("designer.elementProperties.table.textModes.ellipsis", "Ellipsis (...)")}</SelectItem>
								<SelectItem value="clamp">{t("designer.elementProperties.table.textModes.clamp", "Clamp (Multi-line Ellipsis)")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className={components.field}>
						<Label className={typography.fieldLabel}>
							{t("designer.elementProperties.table.cellTextBehavior", "Cell Text Behavior")}
						</Label>
						<Select
							value={rowTextBehavior.mode}
							onValueChange={(mode) => {
								const nextMode = mode as TableTextBehaviorMode;
								updateRowTextBehavior(
									nextMode === "clamp"
										? { mode: nextMode, clampLines: rowTextBehavior.clampLines ?? 2 }
										: { mode: nextMode }
								);
							}}
						>
							<SelectTrigger className={components.inputHeight}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="wrap">{t("designer.elementProperties.table.textModes.wrap", "Wrap (Normal)")}</SelectItem>
								<SelectItem value="nowrap">{t("designer.elementProperties.table.textModes.nowrap", "No Wrap")}</SelectItem>
								<SelectItem value="break-words">{t("designer.elementProperties.table.textModes.breakWords", "Break Words")}</SelectItem>
								<SelectItem value="ellipsis">{t("designer.elementProperties.table.textModes.ellipsis", "Ellipsis (...)")}</SelectItem>
								<SelectItem value="clamp">{t("designer.elementProperties.table.textModes.clamp", "Clamp (Multi-line Ellipsis)")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{headerTextBehavior.mode === "clamp" && (
						<div className={components.field}>
							<Label className={typography.fieldLabel}>
								{t("designer.elementProperties.table.headerClampLines", "Header Clamp Lines")}
							</Label>
							<Input
								type="number"
								min={1}
								max={10}
								value={headerTextBehavior.clampLines ?? 2}
								onChange={(e) => {
									const value = Math.max(1, Math.min(10, Number(e.target.value) || 2));
									updateHeaderTextBehavior({ mode: "clamp", clampLines: value });
								}}
								className={components.inputHeight}
							/>
						</div>
					)}
					{rowTextBehavior.mode === "clamp" && (
						<div className={components.field}>
							<Label className={typography.fieldLabel}>
								{t("designer.elementProperties.table.cellClampLines", "Cell Clamp Lines")}
							</Label>
							<Input
								type="number"
								min={1}
								max={10}
								value={rowTextBehavior.clampLines ?? 2}
								onChange={(e) => {
									const value = Math.max(1, Math.min(10, Number(e.target.value) || 2));
									updateRowTextBehavior({ mode: "clamp", clampLines: value });
								}}
								className={components.inputHeight}
							/>
						</div>
					)}
					<div className={`${components.field} col-span-full`}>
						<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.itemsBinding')}</Label>
						<div className={spacing.fieldGroupGap}>
					<Input
								placeholder={t('designer.elementProperties.table.itemsBindingPlaceholder')}
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
										{t('designer.elementProperties.binding.duplicateError')}
									</p>
									<div className="flex items-center gap-2">
											<p className={`${typography.errorTextSecondary} flex-1 truncate`}>
											{t('designer.elementProperties.binding.suggested')} <span className="font-mono font-medium">{suggestedBinding}</span>
										</p>
										<Button
											type="button"
											size="sm"
											variant="outline"
												className="h-7 px-2.5 text-xs border-amber-300 dark:border-amber-700 bg-background hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0"
											onClick={() => {
												setBindingInput(suggestedBinding);
												onChange({ ...tbl, itemsBinding: suggestedBinding });
											}}
										>
											<Check className="h-3 w-3 mr-1" />
											{t('designer.elementProperties.binding.use')}
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
				<h4 className={typography.subsectionTitle}>{t('designer.elementProperties.table.columns')}</h4>
				<p className={typography.helperText}>
					{`% columns total: ${percentWidthTotal}% / 100%`}
				</p>
				<div className={spacing.fieldGroupGap}>
					{derivedColumns.map((c) => {
						const widthEditor = getEditableTableColumnWidth(c.width);
						return (
							<div key={c.id} className={`${components.card} ${spacing.fieldGroupGap}`}>
								{/* Column Basic Settings */}
								<div className={components.grid}>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.header')}</Label>
									<Input
											placeholder={t('designer.elementProperties.table.column.headerPlaceholder')}
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
										<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.width')}</Label>
										<div className="flex gap-2">
											<Input
												type="number"
												step="0.1"
												min={widthEditor.unit === "%" ? 0 : 0.1}
												placeholder={t('designer.elementProperties.table.column.widthPlaceholder')}
												value={widthEditor.value}
												onChange={(e) => {
													const parsed = Number(e.target.value);
													if (!Number.isFinite(parsed)) return;
													setColumnWidth(c.id, parsed, widthEditor.unit);
												}}
												className={components.inputHeight}
											/>
											<Select
												value={widthEditor.unit}
												onValueChange={(unit) => setColumnWidthUnit(c.id, unit as TableColumnWidthUnit)}
											>
												<SelectTrigger className="h-9 w-20">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="%">%</SelectItem>
													<SelectItem value="fr">fr</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.align')}</Label>
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
											<SelectItem value="left">{t('designer.elementProperties.text.alignments.left')}</SelectItem>
											<SelectItem value="center">{t('designer.elementProperties.text.alignments.center')}</SelectItem>
											<SelectItem value="right">{t('designer.elementProperties.text.alignments.right')}</SelectItem>
										</SelectContent>
									</Select>
									</div>
									<div className={components.field}>
										<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.type')}</Label>
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
											<SelectItem value="text">{t('designer.elementProperties.table.column.types.text')}</SelectItem>
											<SelectItem value="number">{t('designer.elementProperties.table.column.types.number')}</SelectItem>
											<SelectItem value="date">{t('designer.elementProperties.table.column.types.date')}</SelectItem>
												<SelectItem value="currency">{t('designer.elementProperties.table.column.types.currency')}</SelectItem>
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
										{t('designer.elementProperties.table.column.remove')}
									</Button>
								</div>
								</div>
								
								{/* Currency-specific configuration */}
								{c.type === "currency" && (
									<div className={`${separators.nestedContent} ${colors.bgAccent} rounded-md p-3 ${spacing.fieldGroupGap}`}>
										<h5 className={`${typography.subsectionTitle} text-primary`}>{t('designer.elementProperties.table.column.currency.title')}</h5>
										<div className={components.grid}>
											<div className={`${components.field} col-span-full`}>
												<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.currency.currency')}</Label>
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
																: t('designer.elementProperties.table.column.currency.selectCurrency')}
															<ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent className="w-[300px] p-0" align="start">
														<Command>
															<CommandInput placeholder={t('designer.elementProperties.table.column.currency.searchCurrency')} />
															<CommandList>
																<CommandEmpty>{t('designer.elementProperties.table.column.currency.noCurrencyFound')}</CommandEmpty>
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
																			<span className="ml-2 text-muted-foreground">
																				- {curr.name}
																			</span>
																			{curr.symbol && (
																				<span className="ml-1 text-muted-foreground/70">
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
												<Label className="text-xs">{t('designer.elementProperties.table.column.currency.mode')}</Label>
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
														<SelectItem value="independent">{t('designer.elementProperties.table.column.currency.modes.independent')}</SelectItem>
														<SelectItem value="linked">{t('designer.elementProperties.table.column.currency.modes.linked')}</SelectItem>
														<SelectItem value="formula">{t('designer.elementProperties.table.column.currency.modes.formula')}</SelectItem>
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
												const next = base.map((col) => {
													if (col.id === c.id) {
														// If formula is cleared (undefined), also reset mode to independent and remove calc property
														if (formula === undefined) {
															const colWithoutCalc = { ...col };
															delete (colWithoutCalc as { calc?: string }).calc;
															return { ...colWithoutCalc, mode: "independent" as const };
														}
														return { ...col, calc: formula };
													}
													return col;
												});
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
												const next = base.map((col) => {
													if (col.id === c.id) {
														// If formula is cleared (undefined), remove calc property
														if (formula === undefined) {
															const colWithoutCalc = { ...col };
															delete (colWithoutCalc as { calc?: string }).calc;
															return colWithoutCalc;
														}
														return { ...col, calc: formula };
													}
													return col;
												});
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
											<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.showTotal')}</Label>
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
												<h5 className={`${typography.subsectionTitle} text-green-700 dark:text-green-400`}>{t('designer.elementProperties.table.column.total.totalStyling')}</h5>
												<div className={components.grid}>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.backgroundColor')}</Label>
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
														<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.textColor')}</Label>
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
														<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.fontWeight')}</Label>
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
																<SelectItem value="normal">{t('designer.elementProperties.table.column.total.fontWeights.normal')}</SelectItem>
																<SelectItem value="600">{t('designer.elementProperties.table.column.total.fontWeights.semiBold')}</SelectItem>
																<SelectItem value="bold">{t('designer.elementProperties.table.column.total.fontWeights.bold')}</SelectItem>
																<SelectItem value="700">{t('designer.elementProperties.table.column.total.fontWeights.extraBold')}</SelectItem>
															</SelectContent>
														</Select>
													</div>
													<div className={components.field}>
														<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.fontSize')}</Label>
														<Input
															type="number"
															placeholder={t('designer.elementProperties.table.column.total.fontSizePlaceholder')}
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
														<Label className={typography.fieldLabel}>{t('designer.elementProperties.table.column.total.topBorder')}</Label>
														<Input
															placeholder={t('designer.elementProperties.table.column.total.topBorderPlaceholder')}
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
							);
						})}
					<Button
						variant="secondary"
						size="sm"
						className={`${components.inputHeight} text-xs`}
						onClick={() => {
							const columnNum = tbl.columns.length + 1;
							const header = columnNum === 1 ? t('designer.tableColumns.column1') : columnNum === 2 ? t('designer.tableColumns.column2') : `${t('designer.elementProperties.table.columns')} ${columnNum}`;
							const next = [
								...tbl.columns,
									{ id: crypto.randomUUID(), header, width: "1fr", align: "left" as const, type: "text" as const, format: { kind: "none" as const }, showTotal: false },
							];
							onChange({ ...tbl, columns: next });
						}}
					>
						{t('designer.elementProperties.table.addColumn')}
					</Button>
				</div>
			</section>

			{common}
		</div>
	);
}

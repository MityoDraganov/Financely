import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calculator, Plus, Minus, Divide, X as MultiplyIcon, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { FormulaService } from "@/services/formula-service";
import type { TemplateElement } from "@/core";
import { cn } from "@/lib/utils";

type FormulaBuilderProps = {
	formula: string | undefined;
	onChange: (formula: string | undefined) => void;
	currentElement: TemplateElement;
	allElements: TemplateElement[];
	formData?: Record<string, unknown>;
	elementValues?: Map<string, number>;
	onValidate?: (valid: boolean) => void;
	// For table columns: provide the table element and column ID to show other columns
	tableContext?: {
		tableElement: Extract<TemplateElement, { type: "table" }>;
		columnId: string;
	};
};

export function FormulaBuilder({
	formula,
	onChange,
	currentElement,
	allElements,
	onValidate,
	tableContext,
}: FormulaBuilderProps) {
	const [formulaInput, setFormulaInput] = useState(formula || "");
	const [showHelper, setShowHelper] = useState(false);
	const [isExpanded, setIsExpanded] = useState(!!formula);
	const hasFormula = !!formula && formula.trim() !== "";

	// Sync formula input when formula prop changes
	useEffect(() => {
		setFormulaInput(formula || "");
		setIsExpanded(!!formula);
	}, [formula]);

	// Get available field references (other number/currency fields)
	const availableFields = useMemo(() => {
		// If we're in a table column context, prioritize showing other columns of the same table
		if (tableContext) {
			const { tableElement, columnId } = tableContext;
			const sameTableColumns = tableElement.columns
				.filter((col) => col.id !== columnId && (col.type === "number" || col.type === "currency"))
				.map((col) => ({
					id: `${tableElement.id}.${col.id}`,
					label: `${col.header} (${col.binding || col.id})`,
					reference: col.binding || col.id,
					type: "table-column" as const,
				}));
			
			// Also include other fields from outside the table
			const otherFields = allElements
				.filter((el) => {
					if (el.id === currentElement.id || el.id === tableElement.id) return false;
					if (el.type === "input" && el.variant === "number") return true;
					if (el.type === "currency") return true;
					return false;
				})
				.map((el) => {
					if (el.type === "input") {
						return {
							id: el.id,
							label: el.binding || `Input ${el.id.slice(0, 6)}`,
							reference: el.id,
							type: "input" as const,
						};
					}
					if (el.type === "currency") {
						return {
							id: el.id,
							label: el.binding || `Currency ${el.id.slice(0, 6)}`,
							reference: el.id,
							type: "currency" as const,
						};
					}
					return null;
				})
				.filter((field): field is NonNullable<typeof field> => field !== null);
			
			return [...sameTableColumns, ...otherFields];
		}
		
		// Default behavior: show all available fields
		return allElements
			.filter((el) => {
				if (el.id === currentElement.id) return false;
				if (el.type === "input" && el.variant === "number") return true;
				if (el.type === "currency") return true;
				if (el.type === "table") {
					return el.columns.some((col) => col.type === "number" || col.type === "currency");
				}
				return false;
			})
			.map((el) => {
				if (el.type === "input") {
					return {
						id: el.id,
						label: el.binding || `Input ${el.id.slice(0, 6)}`,
						reference: el.id,
						type: "input" as const,
					};
				}
				if (el.type === "currency") {
					return {
						id: el.id,
						label: el.binding || `Currency ${el.id.slice(0, 6)}`,
						reference: el.id,
						type: "currency" as const,
					};
				}
				if (el.type === "table") {
					return el.columns
						.filter((col) => col.type === "number" || col.type === "currency")
						.map((col) => ({
							id: `${el.id}.${col.id}`,
							label: `${el.itemsBinding || "items"}.${col.binding || col.header}`,
							reference: `${el.itemsBinding || "items"}.${col.binding || col.header}`,
							type: "table-column" as const,
						}));
				}
				return null;
			})
			.flat()
			.filter((field): field is NonNullable<typeof field> => field !== null);
	}, [allElements, currentElement.id, tableContext]);

	// Validate formula
	const validation = useMemo(() => {
		if (!formulaInput.trim()) {
			onValidate?.(true);
			return { valid: true };
		}
		const result = FormulaService.validate(formulaInput);
		onValidate?.(result.valid);
		return result;
	}, [formulaInput, onValidate]);

	const handleFormulaChange = (value: string) => {
		setFormulaInput(value);
		if (value.trim() === "") {
			onChange(undefined);
		} else {
			onChange(value);
		}
	};

	const handleToggleFormula = (enabled: boolean) => {
		if (enabled) {
			// Set a default "=" to enable formula mode
			const defaultFormula = "=";
			setFormulaInput(defaultFormula);
			setIsExpanded(true);
			onChange(defaultFormula);
		} else {
			handleFormulaChange("");
			setIsExpanded(false);
			onChange(undefined);
		}
	};

	const insertReference = (reference: string, event?: React.MouseEvent) => {
		event?.preventDefault();
		event?.stopPropagation();
		const input = document.querySelector<HTMLInputElement>('[data-formula-input]');
		const cursorPos = input?.selectionStart || formulaInput.length;
		const newFormula = formulaInput.slice(0, cursorPos) + reference + formulaInput.slice(cursorPos);
		handleFormulaChange(newFormula);
		setShowHelper(false);
		setTimeout(() => {
			if (input) {
				input.focus({ preventScroll: true });
				input.setSelectionRange(cursorPos + reference.length, cursorPos + reference.length);
			}
		}, 0);
	};

	const insertOperator = (operator: string, event?: React.MouseEvent) => {
		event?.preventDefault();
		event?.stopPropagation();
		const input = document.querySelector<HTMLInputElement>('[data-formula-input]');
		const cursorPos = input?.selectionStart || formulaInput.length;
		const newFormula = formulaInput.slice(0, cursorPos) + ` ${operator} ` + formulaInput.slice(cursorPos);
		handleFormulaChange(newFormula);
		setTimeout(() => {
			if (input) {
				input.focus({ preventScroll: true });
				input.setSelectionRange(cursorPos + operator.length + 2, cursorPos + operator.length + 2);
			}
		}, 0);
	};

	const insertFunction = (funcName: string) => {
		const input = document.querySelector<HTMLInputElement>('[data-formula-input]');
		const cursorPos = input?.selectionStart || formulaInput.length;
		const newFormula = formulaInput.slice(0, cursorPos) + `${funcName}()` + formulaInput.slice(cursorPos);
		handleFormulaChange(newFormula);
		setTimeout(() => {
			if (input) {
				input.focus({ preventScroll: true });
				input.setSelectionRange(cursorPos + funcName.length + 1, cursorPos + funcName.length + 1);
			}
		}, 0);
	};

	return (
		<div className="space-y-3">
			{/* Toggle Switch */}
			<div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
				<div className="flex items-center gap-2">
					<Sparkles className={cn("h-4 w-4", hasFormula ? "text-blue-600" : "text-neutral-400")} />
					<div>
						<Label className="text-sm font-medium cursor-pointer" htmlFor="formula-toggle">
							Use Formula
						</Label>
						<p className="text-xs text-neutral-500 mt-0.5">
							Calculate value from other fields
						</p>
					</div>
				</div>
				<Switch
					id="formula-toggle"
					checked={hasFormula}
					onCheckedChange={handleToggleFormula}
				/>
			</div>

			{/* Formula Input Section */}
			{hasFormula && (
				<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
					<div className="space-y-2">
						<CollapsibleTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								className="w-full justify-between h-auto p-2 hover:bg-neutral-50"
							>
								<div className="flex items-center gap-2">
									{isExpanded ? (
										<ChevronDown className="h-4 w-4 text-neutral-500" />
									) : (
										<ChevronRight className="h-4 w-4 text-neutral-500" />
									)}
									<span className="text-xs font-medium text-neutral-700">Formula Editor</span>
									{validation.valid && formulaInput.trim() && (
										<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
									)}
									{!validation.valid && formulaInput.trim() && (
										<AlertCircle className="h-3.5 w-3.5 text-red-600" />
									)}
								</div>
							</Button>
						</CollapsibleTrigger>

						<CollapsibleContent className="space-y-3">
							{/* Formula Input */}
							<div className="space-y-2">
								<Label className="text-xs font-medium text-neutral-700">Formula Expression</Label>
								<div className="relative">
									<Input
										data-formula-input
										value={formulaInput}
										onChange={(e) => handleFormulaChange(e.target.value)}
										placeholder="=SUM(A1, B1) or =A1 + B1"
										className={cn(
											"font-mono text-sm",
											!validation.valid && formulaInput.trim()
												? "border-red-500 focus-visible:ring-red-500"
												: hasFormula
												? "border-blue-300 focus-visible:ring-blue-500"
												: ""
										)}
									/>
									{validation.valid && formulaInput.trim() && (
										<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
											<span className="text-xs text-green-600 font-medium">Valid</span>
										</div>
									)}
								</div>
								
								{!validation.valid && formulaInput.trim() && (
									<div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
										<AlertCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
										<p className="text-xs text-red-800">{validation.error || "Invalid formula syntax"}</p>
									</div>
								)}
							</div>

							{/* Quick Actions */}
							<div className="space-y-2">
								<Label className="text-xs font-medium text-neutral-700">Quick Insert</Label>
								<div className="flex flex-wrap gap-1.5">
									<Popover open={showHelper} onOpenChange={setShowHelper}>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 text-xs"
											>
												<Calculator className="h-3.5 w-3.5 mr-1.5" />
												Fields
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-72 p-2" align="start">
											<div className="space-y-1">
												<div className="text-xs font-semibold text-neutral-700 mb-2 px-1">
													Available Fields
												</div>
												{availableFields.length === 0 ? (
													<div className="text-xs text-neutral-500 p-2">
														No number or currency fields available
													</div>
												) : (
													<div className="max-h-48 overflow-y-auto space-y-0.5">
														{availableFields.map((field) => (
															<Button
																key={field.id}
																type="button"
																variant="ghost"
																size="sm"
																className="w-full justify-start h-auto py-2 px-2 text-xs"
																onClick={(e) => insertReference(field.reference, e)}
															>
																<span className="font-mono text-blue-600">{field.reference}</span>
																<span className="ml-2 text-neutral-500 truncate">{field.label}</span>
															</Button>
														))}
													</div>
												)}
											</div>
										</PopoverContent>
									</Popover>

									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-2 text-xs"
										onClick={(e) => insertOperator("+", e)}
									>
										<Plus className="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-2 text-xs"
										onClick={(e) => insertOperator("-", e)}
									>
										<Minus className="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-2 text-xs"
										onClick={(e) => insertOperator("*", e)}
									>
										<MultiplyIcon className="h-3.5 w-3.5" />
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 px-2 text-xs"
										onClick={(e) => insertOperator("/", e)}
									>
										<Divide className="h-3.5 w-3.5" />
									</Button>

									<Popover>
										<PopoverTrigger asChild>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-8 text-xs"
											>
												<Calculator className="h-3.5 w-3.5 mr-1.5" />
												Functions
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-64 p-2" align="start">
											<div className="space-y-1">
												<div className="text-xs font-semibold text-neutral-700 mb-2 px-1">
													Available Functions
												</div>
												<div className="max-h-48 overflow-y-auto space-y-0.5">
													{[
														{ name: "SUM", description: "Sum of values" },
														{ name: "AVERAGE", description: "Average of values" },
														{ name: "MIN", description: "Minimum value" },
														{ name: "MAX", description: "Maximum value" },
														{ name: "COUNT", description: "Count of values" },
														{ name: "ROUND", description: "Round to decimals" },
														{ name: "IF", description: "Conditional logic" },
														{ name: "ABS", description: "Absolute value" },
													].map((func) => (
														<Button
															key={func.name}
															type="button"
															variant="ghost"
															size="sm"
															className="w-full justify-start h-auto py-2 px-2 text-xs"
															onClick={(e) => {
																e.preventDefault();
																e.stopPropagation();
																insertFunction(func.name);
															}}
														>
															<span className="font-mono text-blue-600">{func.name}()</span>
															<span className="ml-2 text-neutral-500">{func.description}</span>
														</Button>
													))}
												</div>
											</div>
										</PopoverContent>
									</Popover>
								</div>
							</div>

							{/* Examples */}
							<div className="p-2 bg-neutral-50 rounded-md border border-neutral-200">
								<div className="text-xs font-medium text-neutral-700 mb-1.5">Examples</div>
								<div className="font-mono text-[10px] space-y-1 text-neutral-600">
									<div>=SUM(A1, B1)</div>
									<div>=A1 + B1</div>
									<div>=items.total * 0.2</div>
									<div>=ROUND(A1 * 1.1, 2)</div>
								</div>
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>
			)}
		</div>
	);
}

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Calculator, X, Plus, Minus, Divide, X as MultiplyIcon, AlertCircle } from "lucide-react";
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
					reference: col.binding || col.id, // Reference by binding or column ID
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
					// Include table columns of type number or currency
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

	const insertReference = (reference: string, event?: React.MouseEvent) => {
		event?.preventDefault();
		event?.stopPropagation();
		const input = document.querySelector<HTMLInputElement>('[data-formula-input]');
		const cursorPos = input?.selectionStart || formulaInput.length;
		const newFormula = formulaInput.slice(0, cursorPos) + reference + formulaInput.slice(cursorPos);
		handleFormulaChange(newFormula);
		setShowHelper(false);
		// Focus back on input without scrolling
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
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="text-xs">Formula</Label>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-6 px-2 text-xs"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						handleFormulaChange("");
					}}
				>
					<X className="h-3 w-3 mr-1" />
					Clear
				</Button>
			</div>
			
			<div className="space-y-2">
				<div className="relative">
					<Input
						data-formula-input
						value={formulaInput}
						onChange={(e) => handleFormulaChange(e.target.value)}
						placeholder="=SUM(A1, B1) or =A1 + B1"
						className={cn(
							"font-mono text-xs",
							!validation.valid && formulaInput.trim() ? "border-red-500 focus-visible:ring-red-500" : ""
						)}
					/>
				</div>
				
				{!validation.valid && formulaInput.trim() && (
					<div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
						<AlertCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
						<p className="text-xs text-red-800">{validation.error || "Invalid formula syntax"}</p>
					</div>
				)}
			</div>

			{/* Quick Insert Buttons */}
			<div className="flex flex-wrap gap-1.5">
				<Popover open={showHelper} onOpenChange={setShowHelper}>
					<PopoverTrigger asChild>
						<Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
							<Calculator className="h-3 w-3 mr-1" />
							Fields
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-64 p-2" align="start">
						<div className="space-y-1">
							<div className="text-xs font-semibold text-neutral-700 mb-2">Available Fields</div>
							{availableFields.length === 0 ? (
								<div className="text-xs text-neutral-500 p-2">No number or currency fields available</div>
							) : (
								<div className="max-h-48 overflow-y-auto space-y-1">
									{availableFields.map((field) => (
										<Button
											key={field.id}
											type="button"
											variant="ghost"
											size="sm"
											className="w-full justify-start h-auto py-1.5 px-2 text-xs"
											onClick={(e) => insertReference(field.reference, e)}
										>
											<span className="font-mono">{field.reference}</span>
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
					className="h-7 px-2 text-xs"
					onClick={(e) => insertOperator("+", e)}
				>
					<Plus className="h-3 w-3" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={(e) => insertOperator("-", e)}
				>
					<Minus className="h-3 w-3" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={(e) => insertOperator("*", e)}
				>
					<MultiplyIcon className="h-3 w-3" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={(e) => insertOperator("/", e)}
				>
					<Divide className="h-3 w-3" />
				</Button>

				<Select onValueChange={insertFunction}>
					<SelectTrigger className="h-7 px-2 text-xs w-auto">
						<SelectValue placeholder="Functions" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="SUM">SUM()</SelectItem>
						<SelectItem value="AVERAGE">AVERAGE()</SelectItem>
						<SelectItem value="MIN">MIN()</SelectItem>
						<SelectItem value="MAX">MAX()</SelectItem>
						<SelectItem value="COUNT">COUNT()</SelectItem>
						<SelectItem value="ROUND">ROUND()</SelectItem>
						<SelectItem value="IF">IF()</SelectItem>
						<SelectItem value="ABS">ABS()</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Formula Help */}
			<div className="text-xs text-neutral-500 space-y-1">
				<div className="font-semibold">Examples:</div>
				<div className="font-mono text-[10px] space-y-0.5">
					<div>=SUM(A1, B1)</div>
					<div>=A1 + B1</div>
					<div>=items.total * 0.2</div>
					<div>=ROUND(A1 * 1.1, 2)</div>
				</div>
			</div>
		</div>
	);
}


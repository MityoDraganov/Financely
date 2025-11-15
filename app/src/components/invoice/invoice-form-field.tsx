import { Info, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/utils/currencies";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { useState, useEffect, useRef } from "react";

interface BindingField {
	path: string;
	label: string;
	type: "text" | "number" | "date";
	isLinkedCurrency?: boolean;
	hasFormula?: boolean;
	elementId?: string;
}

interface InvoiceFormFieldProps {
	field: BindingField;
	value: InvoiceDataValue;
	onChange: (value: InvoiceDataValue) => void;
	onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
	isReadOnly: boolean;
	isProductLocked: boolean;
	shouldAutoCalculate?: boolean;
	onAutoCalculate?: () => void;
	suggestedValue?: number;
	defaultCurrency: string;
}

export function InvoiceFormField({
	field,
	value,
	onChange,
	onBlur,
	isReadOnly,
	isProductLocked,
	shouldAutoCalculate,
	onAutoCalculate,
	suggestedValue,
	defaultCurrency,
}: InvoiceFormFieldProps) {
	const isAddressField =
		field.path.endsWith(".address") || field.path.endsWith("address");
	const isObjectValue =
		typeof value === "object" && value !== null && !Array.isArray(value);

	// Handle address fields with object values
	if (isAddressField && isObjectValue) {
		const addressObj = value as Record<string, InvoiceDataValue>;
		return (
			<div className="space-y-2">
				<Label htmlFor={field.path}>{field.label}</Label>
				<div className="space-y-2">
					<Input
						id={`${field.path}-street`}
						type="text"
						placeholder="Street Address"
						value={String(addressObj.street ?? "")}
						onChange={(e) => {
							onChange({
								...addressObj,
								street: e.target.value,
							});
						}}
					/>
					<div className="grid grid-cols-2 gap-2">
						<Input
							id={`${field.path}-city`}
							type="text"
							placeholder="City"
							value={String(addressObj.city ?? "")}
							onChange={(e) => {
								onChange({
									...addressObj,
									city: e.target.value,
								});
							}}
						/>
						<Input
							id={`${field.path}-state`}
							type="text"
							placeholder="State/Province"
							value={String(addressObj.state ?? "")}
							onChange={(e) => {
								onChange({
									...addressObj,
									state: e.target.value,
								});
							}}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<Input
							id={`${field.path}-zipCode`}
							type="text"
							placeholder="ZIP/Postal Code"
							value={String(addressObj.zipCode ?? "")}
							onChange={(e) => {
								onChange({
									...addressObj,
									zipCode: e.target.value,
								});
							}}
						/>
						<Input
							id={`${field.path}-country`}
							type="text"
							placeholder="Country"
							value={String(addressObj.country ?? "")}
							onChange={(e) => {
								onChange({
									...addressObj,
									country: e.target.value,
								});
							}}
						/>
					</div>
				</div>
			</div>
		);
	}

	// Use local state to preserve cursor position during typing
	const [localValue, setLocalValue] = useState<string>(() => {
		if (field.type === "number") {
			if (value === null || value === undefined || value === "") {
				return "";
			}
			if (typeof value === "number") {
				return String(value);
			}
			return String(value);
		}
		// For non-number fields, handle objects by returning empty string
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			return "";
		}
		return String(value ?? "");
	});

	const inputRef = useRef<HTMLInputElement>(null);
	const previousValueRef = useRef<InvoiceDataValue>(value);

	// Sync local value with prop value only when it changes externally (not from user typing)
	useEffect(() => {
		// Only update if the value changed externally (not from our own onChange)
		if (value !== previousValueRef.current) {
			const newDisplayValue = (() => {
				if (field.type === "number") {
					if (value === null || value === undefined || value === "") {
						return "";
					}
					if (typeof value === "number") {
						return String(value);
					}
					return String(value);
				}
				if (typeof value === "object" && value !== null && !Array.isArray(value)) {
					return "";
				}
				return String(value ?? "");
			})();

			// Preserve cursor position when updating from external source
			if (inputRef.current && document.activeElement === inputRef.current) {
				const cursorPosition = inputRef.current.selectionStart;
				setLocalValue(newDisplayValue);
				// Restore cursor position after state update
				setTimeout(() => {
					if (inputRef.current) {
						const newPosition = Math.min(cursorPosition ?? 0, newDisplayValue.length);
						inputRef.current.setSelectionRange(newPosition, newPosition);
					}
				}, 0);
			} else {
				setLocalValue(newDisplayValue);
			}
			previousValueRef.current = value;
		}
	}, [value, field.type]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;
		
		// Update local state immediately to preserve cursor position
		setLocalValue(inputValue);

		let val: InvoiceDataValue;

		if (field.type === "number") {
			if (
				inputValue === "" ||
				inputValue === null ||
				inputValue === undefined
			) {
				val = "";
			} else {
				const trimmed = inputValue.trim();
				if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
					val = "";
				} else {
					const numValue = Number(trimmed);
					if (
						!isNaN(numValue) &&
						isFinite(numValue) &&
						trimmed === String(numValue)
					) {
						val = numValue;
					} else {
						val = trimmed;
					}
				}
			}
		} else {
			val = inputValue;
		}

		// Update parent state (non-blocking)
		onChange(val);
		previousValueRef.current = val;
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		if (field.type === "number") {
			const inputValue = e.target.value.trim();
			if (inputValue === "" || inputValue === "-" || inputValue === "." || inputValue === "-.") {
				onChange("");
			} else {
				const numValue = Number(inputValue);
				if (!isNaN(numValue) && isFinite(numValue)) {
					onChange(numValue);
				} else if (inputValue !== "") {
					onChange("");
				}
			}
		}
		if (onBlur) {
			onBlur(e);
		}
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Label htmlFor={field.path}>
						{field.label}
						{field.isLinkedCurrency && (
							<span className="ml-2 text-xs text-muted-foreground font-normal">
								(Linked - read-only)
							</span>
						)}
						{field.hasFormula && (
							<span className="ml-2 text-xs text-muted-foreground font-normal">
								(Formula - read-only)
							</span>
						)}
						{isProductLocked && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="ml-2 h-4 w-4 text-muted-foreground cursor-help" />
									</TooltipTrigger>
									<TooltipContent>
										<p>
											This field is populated from the
											selected product
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</Label>
				</div>
				{shouldAutoCalculate && onAutoCalculate && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-xs"
						onClick={onAutoCalculate}
					>
						Auto-calculate
					</Button>
				)}
			</div>
			<div className="relative">
				<Input
					ref={inputRef}
					id={`binding-${field.path}`}
					type={field.type}
					value={localValue}
					onChange={handleInputChange}
					onBlur={handleBlur}
					placeholder={`Enter ${field.label.toLowerCase()}`}
					readOnly={isReadOnly}
					className={
						isReadOnly
							? "bg-muted cursor-not-allowed"
							: ""
					}
				/>
				{isProductLocked && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-600 cursor-help">
									<CheckCircle2 className="h-3.5 w-3.5" />
								</div>
							</TooltipTrigger>
							<TooltipContent>
								<p>
									This field is populated from the selected
									product
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</div>
			{shouldAutoCalculate && suggestedValue !== undefined && (
				<p className="text-xs text-muted-foreground">
					Suggested: {formatCurrency(suggestedValue, defaultCurrency)}
				</p>
			)}
		</div>
	);
}


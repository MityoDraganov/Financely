import { Info, CheckCircle2, Sparkles, Lock, Zap, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatCurrency } from "@/utils/currencies";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

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
	const { t } = useTranslation();
	const isAddressField =
		field.path.endsWith(".address") || field.path.endsWith("address");
	const isObjectValue =
		typeof value === "object" && value !== null && !Array.isArray(value);

	// Handle address fields with object values
	if (isAddressField && isObjectValue) {
		const addressObj = value as Record<string, InvoiceDataValue>;
		return (
			<div className="space-y-1.5">
				<label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{field.label}
				</label>
				<div className="space-y-2">
					<input
						type="text"
						placeholder={t("invoiceFormField.address.street")}
						value={String(addressObj.street ?? "")}
						onChange={(e) =>
							onChange({ ...addressObj, street: e.target.value })
						}
						className={cn(
							"w-full px-3 py-2 text-sm rounded-md border bg-background",
							"transition-all duration-150",
							"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
							"placeholder:text-muted-foreground/40"
						)}
					/>
					<div className="grid grid-cols-2 gap-2">
						<input
							type="text"
							placeholder={t("invoiceFormField.address.city")}
							value={String(addressObj.city ?? "")}
							onChange={(e) =>
								onChange({ ...addressObj, city: e.target.value })
							}
							className={cn(
								"w-full px-3 py-2 text-sm rounded-md border bg-background",
								"transition-all duration-150",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
								"placeholder:text-muted-foreground/40"
							)}
						/>
						<input
							type="text"
							placeholder={t("invoiceFormField.address.state")}
							value={String(addressObj.state ?? "")}
							onChange={(e) =>
								onChange({ ...addressObj, state: e.target.value })
							}
							className={cn(
								"w-full px-3 py-2 text-sm rounded-md border bg-background",
								"transition-all duration-150",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
								"placeholder:text-muted-foreground/40"
							)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<input
							type="text"
							placeholder={t("invoiceFormField.address.zipCode")}
							value={String(addressObj.zipCode ?? "")}
							onChange={(e) =>
								onChange({ ...addressObj, zipCode: e.target.value })
							}
							className={cn(
								"w-full px-3 py-2 text-sm rounded-md border bg-background",
								"transition-all duration-150",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
								"placeholder:text-muted-foreground/40"
							)}
						/>
						<input
							type="text"
							placeholder={t("invoiceFormField.address.country")}
							value={String(addressObj.country ?? "")}
							onChange={(e) =>
								onChange({ ...addressObj, country: e.target.value })
							}
							className={cn(
								"w-full px-3 py-2 text-sm rounded-md border bg-background",
								"transition-all duration-150",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
								"placeholder:text-muted-foreground/40"
							)}
						/>
					</div>
				</div>
			</div>
		);
	}

	// Use local state to preserve cursor position during typing
	const [localValue, setLocalValue] = useState<string>(() => {
		if (field.type === "number") {
			if (value === null || value === undefined || value === "") return "";
			return String(value);
		}
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			return "";
		}
		return String(value ?? "");
	});

	const [isFilled, setIsFilled] = useState(false);
	const [justFilled, setJustFilled] = useState(false);
	const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
	const justClosedDatePickerRef = useRef(false);
	const focusFromPointerRef = useRef(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const previousValueRef = useRef<InvoiceDataValue>(value);
	const isUserTypingRef = useRef(false);
	const pendingValueRef = useRef<string | null>(null);

	// Sync local value with prop value only when it changes externally
	useEffect(() => {
		if (isUserTypingRef.current) return;

		const currentDisplayValue = (() => {
			if (field.type === "number") {
				if (value === null || value === undefined || value === "") return "";
				return String(value);
			}
			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				return "";
			}
			return String(value ?? "");
		})();

		if (currentDisplayValue !== localValue) {
			if (inputRef.current && document.activeElement === inputRef.current) {
				const cursorPosition = inputRef.current.selectionStart;
				setLocalValue(currentDisplayValue);
				setTimeout(() => {
					if (inputRef.current) {
						const newPosition = Math.min(
							cursorPosition ?? 0,
							currentDisplayValue.length
						);
						inputRef.current.setSelectionRange(newPosition, newPosition);
					}
				}, 0);
			} else {
				setLocalValue(currentDisplayValue);
			}
		}
		previousValueRef.current = value;
	}, [value, field.type, localValue]);

	// Track filled state for the checkmark animation
	useEffect(() => {
		const hasValue =
			localValue !== "" && localValue !== null && localValue !== undefined;
		if (hasValue && !isFilled) {
			setIsFilled(true);
			setJustFilled(true);
			setTimeout(() => setJustFilled(false), 400);
		} else if (!hasValue) {
			setIsFilled(false);
		}
	}, [localValue, isFilled]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputValue = e.target.value;

		isUserTypingRef.current = true;
		pendingValueRef.current = inputValue;
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
				if (
					trimmed === "" ||
					trimmed === "-" ||
					trimmed === "." ||
					trimmed === "-."
				) {
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

		onChange(val);
		previousValueRef.current = val;

		setTimeout(() => {
			isUserTypingRef.current = false;
			pendingValueRef.current = null;
		}, 100);
	};

	const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		if (field.type === "number") {
			const inputValue = e.target.value.trim();
			if (
				inputValue === "" ||
				inputValue === "-" ||
				inputValue === "." ||
				inputValue === "-."
			) {
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
		if (onBlur) onBlur(e);
	};

	const hasValue =
		localValue !== "" && localValue !== null && localValue !== undefined;
	const isAutoField = field.isLinkedCurrency || field.hasFormula;

	return (
		<div className="space-y-1.5">
			{/* Label row */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5">
					<label
						htmlFor={`binding-${field.path}`}
						className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>
						{field.label}
					</label>

					{isAutoField && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 leading-none cursor-help">
										{field.hasFormula ? (
											<Zap className="h-2.5 w-2.5" />
										) : (
											<Sparkles className="h-2.5 w-2.5" />
										)}
										{field.hasFormula
											? t("invoiceFormField.badges.formula")
											: t("invoiceFormField.badges.linked")}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p className="text-xs">
										{field.hasFormula
											? t("invoiceFormField.tooltips.formula")
											: t("invoiceFormField.tooltips.linked")}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{isProductLocked && !isAutoField && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 leading-none cursor-help">
										<Lock className="h-2.5 w-2.5" />
										{t("invoiceFormField.badges.product")}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p className="text-xs">
										{t("invoiceFormField.tooltips.populatedFromProduct")}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>

				{shouldAutoCalculate && onAutoCalculate && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-5 px-2 text-[10px] font-medium text-primary hover:text-primary"
						onClick={onAutoCalculate}
					>
						{t("invoiceFormField.autoCalculate")}
					</Button>
				)}
			</div>

			{/* Input */}
			{field.type === "date" ? (
				<Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
					<PopoverTrigger asChild>
						<div
							id={`binding-${field.path}`}
							role="button"
							tabIndex={isReadOnly ? -1 : 0}
							onPointerDown={() => {
								focusFromPointerRef.current = true;
								setTimeout(() => { focusFromPointerRef.current = false; }, 0);
							}}
							onFocus={() => {
								if (!isReadOnly && !justClosedDatePickerRef.current && !focusFromPointerRef.current) {
									setIsDatePickerOpen(true);
								}
							}}
							onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "F4") setIsDatePickerOpen(true); }}
							className={cn(
								"relative w-full px-3 py-2 pr-8 text-sm rounded-md border bg-background cursor-pointer select-none",
								"transition-all duration-150",
								"focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-transparent",
								hasValue && !isReadOnly && !isAutoField && "border-l-2 border-l-green-500/50",
								isProductLocked && !isAutoField && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
								!isReadOnly && "border-border hover:border-border/80",
								isReadOnly && "opacity-60 cursor-default",
							)}
						>
							{localValue ? (
								<span>{new Date(localValue + "T00:00:00").toLocaleDateString("default", { year: "numeric", month: "short", day: "numeric" })}</span>
							) : (
								<span className="text-muted-foreground/40">
									{t("invoiceFormField.enterField", {
										field: field.label.toLowerCase(),
									})}
								</span>
							)}
							<div className={cn(
								"absolute right-2.5 top-1/2 -translate-y-1/2",
								hasValue && !isReadOnly && !isAutoField ? "text-green-500/70" : "text-muted-foreground/50"
							)}>
								{hasValue && !isReadOnly && !isAutoField ? (
									<CheckCircle2 className={cn("h-3.5 w-3.5", justFilled && "inv-check-pop")} />
								) : (
									<CalendarDays className="h-3.5 w-3.5" />
								)}
							</div>
						</div>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="single"
							selected={localValue ? new Date(localValue + "T00:00:00") : undefined}
							onSelect={(date) => {
								if (date) {
									const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
									setLocalValue(iso);
									onChange(iso);
								} else {
									setLocalValue("");
									onChange("");
								}
								justClosedDatePickerRef.current = true;
								setIsDatePickerOpen(false);
								setTimeout(() => { justClosedDatePickerRef.current = false; }, 200);
							}}
							autoFocus
						/>
					</PopoverContent>
				</Popover>
			) : (
				<div className="relative group">
					<input
						ref={inputRef}
						id={`binding-${field.path}`}
						type={field.type}
						value={localValue}
						onChange={handleInputChange}
						onBlur={handleBlur}
						placeholder={t("invoiceFormField.enterField", {
							field: field.label.toLowerCase(),
						})}
						readOnly={isReadOnly}
						className={cn(
							"w-full px-3 py-2 text-sm rounded-md border bg-background",
							"transition-all duration-150",
							"focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-transparent",
							"placeholder:text-muted-foreground/40",
							// Filled state: subtle green left border
							hasValue && !isReadOnly && !isAutoField &&
								"border-l-2 border-l-green-500/50",
							// Readonly states
							isAutoField &&
								"bg-muted/30 text-muted-foreground border-transparent cursor-default select-none",
							isProductLocked && !isAutoField &&
								"bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
							// Editable default
							!isReadOnly && "border-border hover:border-border/80"
						)}
					/>

					{/* Success checkmark */}
					{hasValue && !isReadOnly && !isAutoField && (
						<div
							className={cn(
								"absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500/70",
								justFilled && "inv-check-pop"
							)}
						>
							<CheckCircle2 className="h-3.5 w-3.5" />
						</div>
					)}

					{/* Product locked indicator */}
					{isProductLocked && !isAutoField && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-400 cursor-help">
										<CheckCircle2 className="h-3.5 w-3.5" />
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p className="text-xs">
										{t("invoiceFormField.tooltips.populatedFromProduct")}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{/* Auto-field sparkle indicator */}
					{isAutoField && (
						<div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40">
							<Info className="h-3.5 w-3.5" />
						</div>
					)}
				</div>
			)}

			{/* Auto-calculate hint */}
			{shouldAutoCalculate && suggestedValue !== undefined && (
				<p className="text-[11px] text-muted-foreground pl-0.5">
					{t("invoiceFormField.suggested")}{" "}
					<button
						type="button"
						onClick={onAutoCalculate}
						className="text-primary hover:underline font-medium"
					>
						{formatCurrency(suggestedValue, defaultCurrency)}
					</button>
				</p>
			)}
		</div>
	);
}

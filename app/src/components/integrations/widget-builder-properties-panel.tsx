import { useMemo, useState } from "react";
import type { ContactMetafieldDefinition } from "@/core";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Trash2,
	Loader2,
	History,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	Database,
	Tag,
} from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useContactMetafieldDefinitions } from "@/hooks/repository-hooks/use-contact-metafields";
import { DeleteWidgetDialog } from "./delete-widget-dialog";
import { Checkbox } from "../ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import {
	getEntityDynamicSourceFields,
	type DynamicSourceValueType,
} from "@/utils/dynamic-sources";
import {
	normalizeSelectOptions,
	type WidgetSelectOption,
} from "@/utils/widget-builder-validation";
import { parseBudgetInput } from "@/utils/budget";

const FIELD_BLOCK_TYPES = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"checkbox",
	"date",
	"file",
	"submitButton",
] as const;

const REQUIRED_FIELD_TYPES = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"date",
	"file",
] as const;

type FieldBlockType = (typeof FIELD_BLOCK_TYPES)[number];

const FIELD_BLOCK_TYPE_OPTIONS: Array<{
	value: FieldBlockType;
	label: string;
}> = [
	{ value: "inputText", label: "Text" },
	{ value: "email", label: "Email" },
	{ value: "phone", label: "Phone" },
	{ value: "textarea", label: "Textarea" },
	{ value: "select", label: "Select" },
	{ value: "checkbox", label: "Checkbox" },
	{ value: "date", label: "Date" },
	{ value: "file", label: "File upload" },
	{ value: "submitButton", label: "Submit button" },
];

type FieldKeyOption = {
	key: string;
	label: string;
	description?: string;
	sourceKind: "field" | "metafield" | "legacy";
	valueType?: DynamicSourceValueType;
	metafieldType?: ContactMetafieldDefinition["type"];
};

type FieldKeyMenuPage = "root" | "contact-fields" | "metafields";
type FieldKeyMenuState = {
	page: FieldKeyMenuPage;
};

const FIELD_KEY_ROOT_PAGE: FieldKeyMenuState = { page: "root" };
const HIDDEN_CONTACT_FIELD_KEYS = new Set([
	"budgetMin",
	"budgetMax",
	"budgetCurrency",
]);

const FILE_METAFIELD_TYPES = new Set<ContactMetafieldDefinition["type"]>([
	"file_reference",
	"file_reference_image",
	"file_reference_video",
	"list.file_reference",
]);

const isFieldBlockType = (type: string): type is FieldBlockType =>
	FIELD_BLOCK_TYPES.includes(type as FieldBlockType);

const getPreferredFieldBlockType = (
	currentType: FieldBlockType,
	option: FieldKeyOption,
): FieldBlockType | null => {
	if (option.metafieldType && FILE_METAFIELD_TYPES.has(option.metafieldType)) {
		return currentType === "file" ? null : "file";
	}

	if (option.valueType === "array" || option.valueType === "object") {
		return currentType === "textarea" ? null : "textarea";
	}

	if (option.valueType === "boolean") {
		return currentType === "checkbox" || currentType === "select"
			? null
			: "checkbox";
	}

	if (option.valueType === "date") {
		return currentType === "date" || currentType === "select"
			? null
			: "date";
	}

	return null;
};

function buildFieldKeyOptions(contactMetafieldDefinitions: Array<{
	id: ContactMetafieldDefinition["id"];
	name: ContactMetafieldDefinition["name"];
	type: ContactMetafieldDefinition["type"];
	description?: ContactMetafieldDefinition["description"];
}>): FieldKeyOption[] {
	const definitionsById = new Map(
		contactMetafieldDefinitions.map((definition) => [definition.id, definition]),
	);
	const sources = getEntityDynamicSourceFields({ contactMetafieldDefinitions }).filter(
		(source) => source.entity === "contact" && source.path !== "organizationId",
	);
	const seenKeys = new Set<string>();
	const options = sources.flatMap((source) => {
		const key = source.path;
		if (!key || seenKeys.has(key)) return [];
		const isNestedContactField =
			source.sourceKind !== "metafield" && key.includes(".");
		if (isNestedContactField) return [];
		if (source.sourceKind !== "metafield" && HIDDEN_CONTACT_FIELD_KEYS.has(key)) {
			return [];
		}
		seenKeys.add(key);
		const isBudgetKey = key === "budget";
		const metafieldDefinitionId =
			source.sourceKind === "metafield" && key.startsWith("metafields.")
				? key.slice("metafields.".length)
				: undefined;
		const metafieldType = metafieldDefinitionId
			? definitionsById.get(metafieldDefinitionId)?.type
			: undefined;
		return [
			{
				key,
				label: isBudgetKey ? "Budget (exact or range)" : source.label,
				description:
					isBudgetKey
						? "Accepts numeric value or numeric range"
						: source.sourceKind === "metafield"
						? source.description
						: `contact.${source.path}`,
				sourceKind: source.sourceKind === "metafield" ? "metafield" : "field",
				valueType: source.valueType,
				metafieldType,
			} satisfies FieldKeyOption,
		];
	});

	if (!seenKeys.has("budget")) {
		options.push({
			key: "budget",
			label: "Budget (exact or range)",
			description: "Accepts numeric value or numeric range",
			sourceKind: "field",
			valueType: "unknown",
			metafieldType: undefined,
		});
	}

	return options;
}

type BudgetOptionMode = "exact" | "range" | "minimum";
type BudgetOptionDraft = {
	mode: BudgetOptionMode;
	exactAmount?: number;
	minAmount?: number;
	maxAmount?: number;
};

const parseBudgetNumber = (value: string): number | undefined => {
	const normalized = value.trim().replace(/,/g, "");
	if (!normalized) return undefined;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const parseBudgetOptionDraft = (rawValue: string): BudgetOptionDraft => {
	const value = rawValue.trim();
	if (!value) return { mode: "exact" };

	const minimumMatch = value.match(/^([\d,.]*)\s*\+$/);
	if (minimumMatch) {
		return { mode: "minimum", minAmount: parseBudgetNumber(minimumMatch[1]) };
	}

	const rangeMatch = value.match(/^([\d,.]*)\s*(?:-|–|—|to)\s*([\d,.]*)$/i);
	if (rangeMatch) {
		return {
			mode: "range",
			minAmount: parseBudgetNumber(rangeMatch[1]),
			maxAmount: parseBudgetNumber(rangeMatch[2]),
		};
	}

	const exactAmount = parseBudgetNumber(value);
	if (exactAmount != null) {
		return { mode: "exact", exactAmount };
	}

	const parsedBudget = parseBudgetInput({ value });
	if (parsedBudget) {
		if (parsedBudget.budget.kind === "exact") {
			return { mode: "exact", exactAmount: parsedBudget.budget.amount };
		}
		if (parsedBudget.budget.minAmount === parsedBudget.budget.maxAmount) {
			return { mode: "minimum", minAmount: parsedBudget.budget.minAmount };
		}
		return {
			mode: "range",
			minAmount: parsedBudget.budget.minAmount,
			maxAmount: parsedBudget.budget.maxAmount,
		};
	}

	return { mode: "exact" };
};

const toBudgetOptionValue = (draft: BudgetOptionDraft): string => {
	if (draft.mode === "exact") {
		return draft.exactAmount != null ? String(draft.exactAmount) : "";
	}
	if (draft.mode === "minimum") {
		return `${draft.minAmount != null ? draft.minAmount : ""}+`;
	}
	return `${draft.minAmount != null ? draft.minAmount : ""}-${draft.maxAmount != null ? draft.maxAmount : ""}`;
};

type FieldKeyMenuHeaderProps = {
	isNested: boolean;
	title: string;
	onGoBack: () => void;
};

const FieldKeyMenuHeader = ({ isNested, title, onGoBack }: FieldKeyMenuHeaderProps) => (
	<div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground border-b border-border/70 bg-muted/35 min-w-0">
		{isNested ? (
			<button
				type="button"
				className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
				onClick={onGoBack}
				aria-label="Go back"
			>
				<ChevronLeft className="h-4 w-4" />
			</button>
		) : null}
		<span className="truncate">{title}</span>
	</div>
);

type FieldKeyOptionListProps = {
	options: FieldKeyOption[];
	selectedKey: string;
	emptyLabel: string;
	onSelectKey: (nextOption: FieldKeyOption) => void;
};

const FieldKeyOptionList = ({
	options,
	selectedKey,
	emptyLabel,
	onSelectKey,
}: FieldKeyOptionListProps) => (
	<div className="max-h-64 overflow-y-auto overflow-x-hidden">
		{options.length === 0 ? (
			<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
				{emptyLabel}
			</DropdownMenuItem>
		) : null}
		{options.map((option) => (
			<DropdownMenuItem
				key={option.key}
				className="min-h-10 rounded-xl text-sm items-start py-2"
				onSelect={(event) => {
					event.preventDefault();
					onSelectKey(option);
				}}
			>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="truncate">{option.label}</span>
					<span className="truncate text-[11px] text-muted-foreground">
						{option.key}
					</span>
				</div>
				{selectedKey === option.key ? (
					<Check className="h-4 w-4 text-primary shrink-0" />
				) : null}
			</DropdownMenuItem>
		))}
	</div>
);

type FieldKeySelectorProps = {
	value: string;
	contactFieldOptions: FieldKeyOption[];
	contactMetafieldOptions: FieldKeyOption[];
	metafieldsLoading: boolean;
	metafieldsError: boolean;
	onSelectKey: (nextOption: FieldKeyOption) => void;
};

function FieldKeySelector({
	value,
	contactFieldOptions,
	contactMetafieldOptions,
	metafieldsLoading,
	metafieldsError,
	onSelectKey,
}: FieldKeySelectorProps) {
	const [open, setOpen] = useState(false);
	const [pageStack, setPageStack] = useState<FieldKeyMenuState[]>([FIELD_KEY_ROOT_PAGE]);
	const allSelectableOptions = useMemo(
		() => [...contactFieldOptions, ...contactMetafieldOptions],
		[contactFieldOptions, contactMetafieldOptions],
	);
	const selectedOption = allSelectableOptions.find((option) => option.key === value);
	const legacyOption =
		value && !selectedOption
			? ({
					key: value,
					label: "Current key (legacy)",
					description: "This key is not in contact fields or contact metafields",
					sourceKind: "legacy",
			  } satisfies FieldKeyOption)
			: null;

	const currentState = pageStack[pageStack.length - 1] ?? FIELD_KEY_ROOT_PAGE;
	const currentPage = currentState.page;
	const isNested = pageStack.length > 1;

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setPageStack([FIELD_KEY_ROOT_PAGE]);
		}
	};

	const goToPage = (page: FieldKeyMenuPage) => {
		setPageStack((prev) => [...prev, { page }]);
	};

	const goBack = () => {
		setPageStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
	};

	const handleSelectKey = (nextOption: FieldKeyOption) => {
		onSelectKey(nextOption);
		setOpen(false);
		setPageStack([FIELD_KEY_ROOT_PAGE]);
	};

	const title =
		currentPage === "contact-fields"
			? "Contact fields"
			: currentPage === "metafields"
				? "Contact metafields"
				: "Choose field key";

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					className="mt-1 w-full h-auto min-h-9 px-3 py-2 justify-between font-normal"
				>
					<span className="min-w-0 text-left">
						<span className="block text-sm truncate text-foreground">
							{selectedOption?.label ?? legacyOption?.label ?? "Select field key"}
						</span>
						<span className="block text-[11px] text-muted-foreground truncate">
							{value || "No key selected"}
						</span>
					</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				sideOffset={8}
				className="w-[320px] rounded-2xl p-0 overflow-x-hidden overflow-y-hidden"
			>
				<FieldKeyMenuHeader isNested={isNested} title={title} onGoBack={goBack} />
				<div className="p-1.5 overflow-x-hidden">
					{currentPage === "root" ? (
						<>
							<DropdownMenuItem
								className="h-11 rounded-xl text-base flex items-center justify-between"
								onSelect={(event) => {
									event.preventDefault();
									goToPage("contact-fields");
								}}
							>
								<span className="inline-flex items-center gap-2 min-w-0">
									<Database className="h-4 w-4 shrink-0" />
									<span className="truncate">Contact fields</span>
								</span>
								<span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
									{contactFieldOptions.length}
									<ChevronRight className="h-4 w-4" />
								</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								className="h-11 rounded-xl text-base flex items-center justify-between"
								onSelect={(event) => {
									event.preventDefault();
									goToPage("metafields");
								}}
							>
								<span className="inline-flex items-center gap-2 min-w-0">
									<Tag className="h-4 w-4 shrink-0" />
									<span className="truncate">Contact metafields</span>
								</span>
								<span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
									{contactMetafieldOptions.length}
									<ChevronRight className="h-4 w-4" />
								</span>
							</DropdownMenuItem>
							{legacyOption ? (
								<>
									<DropdownMenuSeparator />
									<FieldKeyOptionList
										options={[legacyOption]}
										selectedKey={value}
										emptyLabel=""
										onSelectKey={handleSelectKey}
									/>
								</>
							) : null}
						</>
					) : null}
					{currentPage === "contact-fields" ? (
						<FieldKeyOptionList
							options={contactFieldOptions}
							selectedKey={value}
							emptyLabel="No contact fields available"
							onSelectKey={handleSelectKey}
						/>
					) : null}
					{currentPage === "metafields" ? (
						metafieldsLoading ? (
							<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading contact metafields…
							</DropdownMenuItem>
						) : metafieldsError ? (
							<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
								Failed to load contact metafields
							</DropdownMenuItem>
						) : (
							<FieldKeyOptionList
								options={contactMetafieldOptions}
								selectedKey={value}
								emptyLabel="No contact metafields defined yet"
								onSelectKey={handleSelectKey}
							/>
						)
					) : null}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function formatVersionTimestamp(value: unknown): string {
	if (!value) return "Recently";
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? "Recently" : value.toLocaleString();
	}
	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
	}
	if (typeof value === "object" && value !== null) {
		if ("toDate" in value && typeof value.toDate === "function") {
			const parsed = value.toDate();
			return parsed instanceof Date && !Number.isNaN(parsed.getTime())
				? parsed.toLocaleString()
				: "Recently";
		}
		if ("seconds" in value && typeof value.seconds === "number") {
			return new Date(value.seconds * 1000).toLocaleString();
		}
		if ("_seconds" in value && typeof value._seconds === "number") {
			return new Date(value._seconds * 1000).toLocaleString();
		}
	}
	return "Recently";
}

type WidgetBuilderPropertiesPanelProps = {
	isMergedSidebar?: boolean;
	onBack?: () => void;
	backLabel?: string;
};

export function WidgetBuilderPropertiesPanel({
	isMergedSidebar = false,
	onBack,
	backLabel = "Back",
}: WidgetBuilderPropertiesPanelProps = {}) {
	const ctx = useWidgetBuilderContext();
	const widgetDesigner = useWidgetDesigner();
	const { data: organization } = useCurrentOrganization();
	const pages = ctx?.pages ?? [];
	const activePageId = ctx?.activePageId ?? null;
	const activePage = pages.find((p) => p.id === activePageId) ?? null;
	const selectedBlock = ctx?.selectedBlock;
	const onUpdateProps = ctx?.updateBlockProps ?? (() => {});
	const onUpdateFieldBlockType = ctx?.updateFieldBlockType ?? (() => {});
	const updatePage = ctx?.updatePage ?? (() => {});
	const multiStepOptions = ctx?.multiStepOptions ?? {};
	const setMultiStepOptions = ctx?.setMultiStepOptions ?? (() => {});
	const versions = ctx?.versions ?? [];
	const selectedVersionId = ctx?.selectedVersionId ?? null;
	const selectedVersion = versions.find((v) => v.id === selectedVersionId);
	const widgetName = ctx?.widgetName ?? "";
	const setWidgetName = ctx?.setWidgetName ?? (() => {});
	const handleWidgetNameBlur = ctx?.handleWidgetNameBlur ?? (async () => {});
	const widgetNameSaving = ctx?.widgetNameSaving ?? false;
	const currentWidgetId = widgetDesigner?.currentWidgetId;
	const deleteWidgetId = ctx?.deleteWidgetId ?? null;
	const setDeleteWidgetId = ctx?.setDeleteWidgetId ?? (() => {});
	const onDeleteWidget = ctx?.onDeleteWidget;
	const { data: contactMetafieldDefinitions = [], isLoading: contactMetafieldsLoading, isError: contactMetafieldsError } =
		useContactMetafieldDefinitions(organization?.id);
	const fieldKeyOptions = useMemo(
		() => buildFieldKeyOptions(contactMetafieldDefinitions),
		[contactMetafieldDefinitions],
	);
	const contactFieldOptions = useMemo(
		() => fieldKeyOptions.filter((option) => option.sourceKind === "field"),
		[fieldKeyOptions],
	);
	const contactMetafieldOptions = useMemo(
		() => fieldKeyOptions.filter((option) => option.sourceKind === "metafield"),
		[fieldKeyOptions],
	);
	const selectedBlockValidationIssues = useMemo(
		() =>
			selectedBlock
				? (ctx?.validationIssues ?? []).filter((issue) => issue.blockId === selectedBlock.id)
				: [],
		[ctx?.validationIssues, selectedBlock],
	);
	const selectedSelectOptionErrorsByIndex = useMemo(() => {
		const lookup: Record<number, string[]> = {};
		selectedBlockValidationIssues.forEach((issue) => {
			if (issue.optionIndex == null) return;
			if (!lookup[issue.optionIndex]) lookup[issue.optionIndex] = [];
			lookup[issue.optionIndex].push(issue.message);
		});
		return lookup;
	}, [selectedBlockValidationIssues]);
	const selectedBlockGeneralErrors = useMemo(
		() => selectedBlockValidationIssues.filter((issue) => issue.optionIndex == null),
		[selectedBlockValidationIssues],
	);

	return (
		<aside
			className={cn(
				"w-80 shrink-0 h-full min-h-0 overflow-hidden flex flex-col",
				isMergedSidebar ? "border-r bg-background" : "border-l bg-muted/20",
			)}
		>
			{isMergedSidebar && onBack ? (
				<div className="shrink-0 flex items-center gap-2 border-b bg-background px-3 py-2">
					<Button
						variant="ghost"
						size="sm"
						className="-ml-1"
						onClick={onBack}
					>
						<ChevronLeft className="h-4 w-4 mr-1" />
						{backLabel}
					</Button>
				</div>
			) : null}
			<div className="h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
				<Tabs
					defaultValue="page-widget"
					className="flex flex-col flex-1 min-h-0"
				>
					<div className="px-4 pt-4">
						<TabsList className="w-full grid grid-cols-2 mb-3 rounded-sm">
							<TabsTrigger value="block" className="rounded-sm">
								Block
							</TabsTrigger>
							<TabsTrigger value="page-widget" className="rounded-sm">
								Page & Widget
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent
						value="block"
						className="flex-1 mt-0 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4"
					>
						{!selectedBlock ? (
							<p className="text-xs text-muted-foreground">
								Select a field to edit its settings.
							</p>
						) : (
							<div className="space-y-3">
								<div>
									<Label className="text-xs">Type</Label>
									{isFieldBlockType(selectedBlock.type) ? (
										<Select
											value={selectedBlock.type}
											onValueChange={(nextType) =>
												onUpdateFieldBlockType(
													selectedBlock.id,
													nextType as FieldBlockType,
												)
											}
										>
											<SelectTrigger className="mt-1 w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{FIELD_BLOCK_TYPE_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<p className="text-sm font-medium">
											{selectedBlock.type}
										</p>
									)}
								</div>
								{selectedBlock.type === "sectionHeader" && (
									<>
										<div>
											<Label className="text-xs">
												Title
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															title?: string;
														}
													).title ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															title: e.target
																.value,
														},
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">
												Description
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															description?: string;
														}
													).description ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															description:
																e.target.value,
														},
													)
												}
											/>
										</div>
									</>
								)}
								{selectedBlock.type === "paragraph" && (
									<div>
										<Label className="text-xs">
											Content
										</Label>
										<Input
											className="mt-1"
											value={
												(
													selectedBlock.props as {
														content?: string;
													}
												).content ?? ""
											}
											onChange={(e) =>
												onUpdateProps(
													selectedBlock.id,
													{
														content: e.target.value,
													},
												)
											}
										/>
									</div>
								)}
								{FIELD_BLOCK_TYPES.includes(
									selectedBlock.type as (typeof FIELD_BLOCK_TYPES)[number],
								) && (
									<>
										<div>
											<Label className="text-xs">
												Label
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															label?: string;
														}
													).label ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															label: e.target
																.value,
														},
													)
												}
											/>
										</div>
										{selectedBlock.type !==
											"submitButton" && (
											<>
												<div>
													<Label className="text-xs">
														Field key
													</Label>
													<FieldKeySelector
														value={
															(
																selectedBlock.props as {
																	fieldKey?: string;
																}
															).fieldKey ?? ""
														}
														contactFieldOptions={contactFieldOptions}
														contactMetafieldOptions={contactMetafieldOptions}
														metafieldsLoading={contactMetafieldsLoading}
														metafieldsError={contactMetafieldsError}
														onSelectKey={(nextOption) => {
															const nextProps: Record<string, unknown> = {
																fieldKey: nextOption.key,
																fieldValueType: nextOption.valueType ?? "unknown",
															};
															if (
																nextOption.metafieldType &&
																FILE_METAFIELD_TYPES.has(nextOption.metafieldType)
															) {
																nextProps.multiple = nextOption.metafieldType.startsWith("list.");
															}
															const preferredType = getPreferredFieldBlockType(
																selectedBlock.type as FieldBlockType,
																nextOption,
															);
															if (
																preferredType &&
																preferredType !== selectedBlock.type
															) {
																onUpdateFieldBlockType(
																	selectedBlock.id,
																	preferredType,
																);
															}
															onUpdateProps(selectedBlock.id, nextProps);
														}}
													/>
												</div>
												{selectedBlock.type !== "file" && (
													<div>
														<Label className="text-xs">
															Placeholder
														</Label>
														<Input
															className="mt-1"
															value={
																(
																	selectedBlock.props as {
																		placeholder?: string;
																	}
																).placeholder ?? ""
															}
															onChange={(e) =>
																onUpdateProps(
																	selectedBlock.id,
																	{
																		placeholder:
																			e.target
																				.value,
																	},
																)
															}
														/>
													</div>
												)}
											</>
										)}
									</>
								)}
								{selectedBlock.type === "successBlock" && (
									<>
										<div>
											<Label className="text-xs">
												Message
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															message?: string;
														}
													).message ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															message:
																e.target.value,
														},
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">
												Redirect URL
											</Label>
											<Input
												className="mt-1"
												value={
													(
														selectedBlock.props as {
															redirectUrl?: string;
														}
													).redirectUrl ?? ""
												}
												onChange={(e) =>
													onUpdateProps(
														selectedBlock.id,
														{
															redirectUrl:
																e.target.value,
														},
													)
												}
												placeholder="https://..."
											/>
										</div>
									</>
								)}
								{REQUIRED_FIELD_TYPES.includes(
									selectedBlock.type as (typeof REQUIRED_FIELD_TYPES)[number],
								) && (
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id={`builder-required-${selectedBlock.id}`}
											checked={
												(
													selectedBlock.props as {
														required?: boolean;
													}
												).required ?? false
											}
											onChange={(e) =>
												onUpdateProps(
													selectedBlock.id,
													{
														required:
															e.target.checked,
													},
												)
											}
										/>
										<Label
											htmlFor={`builder-required-${selectedBlock.id}`}
											className="text-xs"
										>
											Required
										</Label>
									</div>
								)}
								{selectedBlock.type === "select" &&
									(() => {
										const options = normalizeSelectOptions(
											(
												selectedBlock.props as {
													options?: unknown;
													fieldKey?: string;
												}
											).options,
										);
										const fieldKey =
											(
												selectedBlock.props as {
													fieldKey?: string;
												}
											).fieldKey ?? "";
										const isBudgetField = fieldKey === "budget";
										const updateOptionAt = (
											optionIndex: number,
											changes: Partial<WidgetSelectOption>,
										) => {
											onUpdateProps(selectedBlock.id, {
												options: options.map((option, currentIndex) =>
													currentIndex === optionIndex
														? { ...option, ...changes }
														: option,
												),
											});
										};
										const updateBudgetDraft = (
											optionIndex: number,
											draft: BudgetOptionDraft,
										) => {
											updateOptionAt(optionIndex, {
												value: toBudgetOptionValue(draft),
											});
										};
										return (
											<div>
												<Label className="text-xs">
													Options
												</Label>
												{selectedBlockGeneralErrors.map((issue, issueIndex) => (
													<p
														key={`${selectedBlock.id}-validation-${issueIndex}`}
														className="mt-1 text-xs text-destructive"
													>
														{issue.message}
													</p>
												))}
												{isBudgetField ? (
													<p className="mt-1 text-xs text-muted-foreground">
														Budget values are now structured to avoid syntax mistakes.
													</p>
												) : null}
												<div className="mt-1 space-y-2">
													{options.map((opt, i) => (
														<div
															key={i}
															className="space-y-1.5 rounded-md border border-border/70 p-2"
														>
															<div className="flex items-start gap-2">
																<div className="flex-1 min-w-0 space-y-1.5">
																	<div className="space-y-1">
																		<Label className="text-[11px] text-muted-foreground">
																			What users see
																		</Label>
																		<Input
																			className="h-8"
																			value={opt.label}
																			onChange={(e) =>
																				updateOptionAt(i, {
																					label: e.target.value,
																				})
																			}
																			placeholder="Display label"
																		/>
																	</div>
																	{isBudgetField ? (
																		(() => {
																			const budgetDraft = parseBudgetOptionDraft(opt.value);
																			return (
																				<div className="space-y-1.5">
																					<div className="space-y-1">
																						<Label className="text-[11px] text-muted-foreground">
																							Budget format
																						</Label>
																						<Select
																							value={budgetDraft.mode}
																							onValueChange={(nextMode) => {
																								const mode = nextMode as BudgetOptionMode;
																								if (mode === "exact") {
																									updateBudgetDraft(i, {
																										mode,
																										exactAmount:
																											budgetDraft.exactAmount ??
																											budgetDraft.minAmount,
																									});
																									return;
																								}
																								if (mode === "minimum") {
																									updateBudgetDraft(i, {
																										mode,
																										minAmount:
																											budgetDraft.minAmount ??
																											budgetDraft.exactAmount,
																									});
																									return;
																								}
																								const nextMinAmount =
																									budgetDraft.minAmount ??
																									budgetDraft.exactAmount;
																								updateBudgetDraft(i, {
																									mode,
																									minAmount: nextMinAmount,
																									maxAmount:
																										budgetDraft.maxAmount ??
																										nextMinAmount,
																								});
																							}}
																						>
																							<SelectTrigger className="h-8 text-xs">
																								<SelectValue />
																							</SelectTrigger>
																							<SelectContent>
																								<SelectItem value="exact">Exact amount</SelectItem>
																								<SelectItem value="range">Range</SelectItem>
																								<SelectItem value="minimum">At least</SelectItem>
																							</SelectContent>
																						</Select>
																					</div>
																					{budgetDraft.mode === "exact" ? (
																						<div className="space-y-1">
																							<Label className="text-[11px] text-muted-foreground">
																								Amount
																							</Label>
																							<Input
																								type="number"
																								min="0"
																								step="any"
																								className="h-8 font-mono text-xs"
																								value={
																									budgetDraft.exactAmount != null
																										? String(budgetDraft.exactAmount)
																										: ""
																								}
																								onChange={(e) =>
																									updateBudgetDraft(i, {
																										mode: "exact",
																										exactAmount: parseBudgetNumber(
																											e.target.value,
																										),
																									})
																								}
																								placeholder="e.g. 5000"
																							/>
																						</div>
																					) : null}
																					{budgetDraft.mode === "range" ? (
																						<div className="grid grid-cols-2 gap-2">
																							<div className="space-y-1">
																								<Label className="text-[11px] text-muted-foreground">
																									Min
																								</Label>
																								<Input
																									type="number"
																									min="0"
																									step="any"
																									className="h-8 font-mono text-xs"
																									value={
																										budgetDraft.minAmount != null
																											? String(budgetDraft.minAmount)
																											: ""
																									}
																									onChange={(e) =>
																										(() => {
																											const nextMinAmount = parseBudgetNumber(
																												e.target.value,
																											);
																											let nextMaxAmount = budgetDraft.maxAmount;
																											if (
																												typeof nextMinAmount === "number" &&
																												typeof nextMaxAmount === "number" &&
																												nextMaxAmount < nextMinAmount
																											) {
																												nextMaxAmount = nextMinAmount;
																											}
																											updateBudgetDraft(i, {
																												mode: "range",
																												minAmount: nextMinAmount,
																												maxAmount: nextMaxAmount,
																											});
																										})()
																									}
																									placeholder="1000"
																								/>
																							</div>
																							<div className="space-y-1">
																								<Label className="text-[11px] text-muted-foreground">
																									Max
																								</Label>
																								<Input
																									type="number"
																									min="0"
																									step="any"
																									className="h-8 font-mono text-xs"
																									value={
																										budgetDraft.maxAmount != null
																											? String(budgetDraft.maxAmount)
																											: ""
																									}
																									onChange={(e) =>
																										(() => {
																											const nextMaxAmount = parseBudgetNumber(
																												e.target.value,
																											);
																											updateBudgetDraft(i, {
																												mode: "range",
																												minAmount: budgetDraft.minAmount,
																												maxAmount: nextMaxAmount,
																											});
																										})()
																									}
																									onBlur={(e) =>
																										(() => {
																											const currentMaxAmount = parseBudgetNumber(
																												e.target.value,
																											);
																											if (
																												typeof budgetDraft.minAmount === "number" &&
																												typeof currentMaxAmount === "number" &&
																												currentMaxAmount < budgetDraft.minAmount
																											) {
																												updateBudgetDraft(i, {
																													mode: "range",
																													minAmount: budgetDraft.minAmount,
																													maxAmount: budgetDraft.minAmount,
																												});
																											}
																										})()
																									}
																									placeholder="5000"
																								/>
																							</div>
																						</div>
																					) : null}
																					{budgetDraft.mode === "minimum" ? (
																						<div className="space-y-1">
																							<Label className="text-[11px] text-muted-foreground">
																								Minimum amount
																							</Label>
																							<Input
																								type="number"
																								min="0"
																								step="any"
																								className="h-8 font-mono text-xs"
																								value={
																									budgetDraft.minAmount != null
																										? String(budgetDraft.minAmount)
																										: ""
																								}
																								onChange={(e) =>
																									updateBudgetDraft(i, {
																										mode: "minimum",
																										minAmount: parseBudgetNumber(
																											e.target.value,
																										),
																									})
																								}
																								placeholder="e.g. 10000"
																							/>
																						</div>
																					) : null}
																					<p className="text-[11px] text-muted-foreground">
																						Submitted value:{" "}
																						<code>{opt.value || "—"}</code>
																					</p>
																				</div>
																			);
																		})()
																	) : (
																		<div className="space-y-1">
																			<Label className="text-[11px] text-muted-foreground">
																				Submitted value
																			</Label>
																			<Input
																				className="h-8 font-mono text-xs"
																				value={opt.value}
																				onChange={(e) =>
																					updateOptionAt(i, {
																						value: e.target.value,
																					})
																				}
																				placeholder="Stored payload value"
																			/>
																		</div>
																	)}
																	{(selectedSelectOptionErrorsByIndex[i] ?? []).map(
																		(errorMessage, errorIndex) => (
																			<p
																				key={`${selectedBlock.id}-option-${i}-error-${errorIndex}`}
																				className="text-xs text-destructive"
																			>
																				{errorMessage}
																			</p>
																		),
																	)}
																</div>
																<Button
																	type="button"
																	variant="secondary"
																	size="icon"
																	className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
																	onClick={() =>
																		onUpdateProps(
																			selectedBlock.id,
																			{
																				options:
																					options.filter(
																						(
																							_,
																							optionIndex,
																						) =>
																							optionIndex !== i,
																					),
																			},
																		)
																	}
																	aria-label="Remove option"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
														</div>
													))}
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="w-full text-muted-foreground"
														onClick={() =>
															onUpdateProps(
																selectedBlock.id,
																{
																	options: [
																		...options,
																		{ label: "", value: "" } satisfies WidgetSelectOption,
																	],
																},
															)
														}
													>
														+ Add option
													</Button>
												</div>
											</div>
										);
									})()}
							</div>
						)}
					</TabsContent>
					<TabsContent
						value="page-widget"
						className="flex-1 mt-0 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
					>
						<div className="px-4 pb-4">
							{currentWidgetId && (
								<div className="space-y-1.5">
									<Label className="text-xs">Widget name</Label>
									<Input
										value={widgetName}
										onChange={(e) => setWidgetName(e.target.value)}
										onBlur={() => void handleWidgetNameBlur()}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											(e.target as HTMLInputElement).blur()
										}
										placeholder="Widget name"
										disabled={widgetNameSaving}
										className="h-9"
									/>
								</div>
							)}
							{activePage && (
								<div className="space-y-3 mt-3">
									<p className="text-xs font-medium text-muted-foreground">
										Page
									</p>
									<div>
										<Label className="text-xs">Name</Label>
										<Input
											className="mt-1"
											value={activePage.name}
											onChange={(e) =>
												updatePage(activePage.id, {
													name: e.target.value,
												})
											}
										/>
									</div>
									<div>
										<Label className="text-xs">
											Description (optional)
										</Label>
										<Input
											className="mt-1"
											value={activePage.description ?? ""}
											onChange={(e) =>
												updatePage(activePage.id, {
													description:
														e.target.value || undefined,
												})
											}
											placeholder="Helper text for this page"
										/>
									</div>
								</div>
							)}
							<div className="space-y-3 border-t pt-3 mt-3">
								<p className="text-xs font-medium text-muted-foreground">
									Widget
								</p>
								<div className="flex items-center gap-2">
									<Checkbox
										id="builder-show-progress-bar"
										checked={
											multiStepOptions.showProgressBar ??
											false
										}
										onChange={(e) =>
											setMultiStepOptions({
												...multiStepOptions,
												showProgressBar: (
													e.target as HTMLInputElement
												).checked,
											})
										}
									/>
									<Label htmlFor="builder-show-progress-bar">
										Show progress bar
									</Label>
								</div>
								{(multiStepOptions.showProgressBar ?? false) && (
									<div>
										<Label className="text-xs">
											Progress bar position
										</Label>
										<Select
											value={
												multiStepOptions.progressBarPosition ??
												"top"
											}
											onValueChange={(value) =>
												setMultiStepOptions({
													...multiStepOptions,
													progressBarPosition: value as "top" | "bottom",
												})
											}
										>
											<SelectTrigger className="mt-1 w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="top">Top</SelectItem>
												<SelectItem value="bottom">Bottom</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
								<div>
									<Label className="text-xs">
										Progress style
									</Label>
									<Select
										value={
											multiStepOptions.progressStyle ??
											"steps"
										}
										onValueChange={(value) =>
											setMultiStepOptions({
												...multiStepOptions,
												progressStyle: value as "steps" | "percentage",
											})
										}
									>
										<SelectTrigger className="mt-1 w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="steps">
												Steps (Page 1 / Page 2)
											</SelectItem>
											<SelectItem value="percentage">
												Percentage
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-xs">Next label</Label>
									<Input
										className="mt-1"
										value={multiStepOptions.nextLabel ?? ""}
										onChange={(e) =>
											setMultiStepOptions({
												...multiStepOptions,
												nextLabel:
													e.target.value || undefined,
											})
										}
										placeholder="Continue"
									/>
								</div>
								<div>
									<Label className="text-xs">Back label</Label>
									<Input
										className="mt-1"
										value={multiStepOptions.backLabel ?? ""}
										onChange={(e) =>
											setMultiStepOptions({
												...multiStepOptions,
												backLabel:
													e.target.value || undefined,
											})
										}
										placeholder="Back"
									/>
								</div>
								<div>
									<Label className="text-xs">Submit label</Label>
									<Input
										className="mt-1"
										value={multiStepOptions.submitLabel ?? ""}
										onChange={(e) =>
											setMultiStepOptions({
												...multiStepOptions,
												submitLabel:
													e.target.value || undefined,
											})
										}
										placeholder="Submit"
									/>
								</div>
							</div>
						</div>
						<div className="space-y-2 border-t pt-3 mt-3">
							<p className="px-4 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
								<History className="h-3.5 w-3.5" />
								Version history
							</p>
							{ctx?.versionsLoading ? (
								<div className="flex items-center justify-center px-4 py-4">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							) : versions.length === 0 ? (
								<p className="px-4 text-xs text-muted-foreground">No versions yet.</p>
							) : (
								<div className="relative">
									<div className="space-y-1 px-4">
										{versions.map((version) => {
											const isSelected = selectedVersionId === version.id;
											return (
												<button
													key={version.id}
													type="button"
													onClick={() => ctx?.setSelectedVersionId(version.id)}
													className={cn(
														"w-full rounded border px-2 py-1.5 text-left",
														isSelected
															? "border-primary bg-primary/5"
															: "border-transparent bg-background hover:bg-muted/50",
													)}
												>
													<div className="flex items-center justify-between gap-1.5">
														<span className="text-xs font-medium">
															v{version.versionNumber}
														</span>
													</div>
													<p className="mt-1 text-[11px] text-muted-foreground">
														{formatVersionTimestamp(version.createdAt)}
													</p>
												</button>
											);
										})}
									</div>
									<div className="sticky bottom-0 mt-2">
										<div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-muted/95 via-muted/60 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_top,black,transparent)]" />
										<div className="relative bg-muted/95 px-4 pt-2 pb-1">
											<div className="grid gap-1.5">
												<Button
													size="sm"
													className="h-8 text-xs"
													onClick={() =>
														selectedVersion && void ctx?.restoreVersion(selectedVersion.id)
													}
													disabled={
														!selectedVersion ||
														ctx?.restoringVersion ||
														ctx?.saving
													}
												>
													{ctx?.restoringVersion ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : null}
													Restore selected
												</Button>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</TabsContent>
					</Tabs>
			</div>
			{currentWidgetId && onDeleteWidget && (
				<div className="shrink-0 border-t bg-muted px-4 py-3">
					<Button
						variant="outline"
						size="sm"
						className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={() =>
							setDeleteWidgetId(currentWidgetId)
						}
					>
						<Trash2 className="h-3.5 w-3.5 mr-1.5" />
						Delete widget
					</Button>
				</div>
			)}
			{onDeleteWidget && (
				<DeleteWidgetDialog
					open={deleteWidgetId !== null}
					onOpenChange={(open) => !open && setDeleteWidgetId(null)}
					widgetId={deleteWidgetId}
					onConfirm={async (id) => {
						await onDeleteWidget(id);
						setDeleteWidgetId(null);
					}}
				/>
			)}
		</aside>
	);
}

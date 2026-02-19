import { useMemo, useState } from "react";
import { Braces, ChevronLeft, ChevronRight, Database, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DynamicSourceField } from "@/utils/dynamic-sources";

export type DynamicSourceOption = {
	key: string;
	label: string;
	description?: string;
	dynamicSource: DynamicSourceField | null;
	categoryKey: string;
	categoryLabel: string;
};

export type PlaceholderOption = {
	id: string;
	key: string;
	label?: string;
};

type MenuPage = "root" | "category-list" | "source-list" | "placeholder-list";
type MenuState = {
	page: MenuPage;
	categoryKey?: string;
};

type CategoryBucket = {
	key: string;
	label: string;
	sources: DynamicSourceOption[];
};

const ROOT_PAGE: MenuState = { page: "root" };

const buildCategoryBuckets = (availableSources: DynamicSourceOption[]): CategoryBucket[] =>
	availableSources.reduce<CategoryBucket[]>((acc, source) => {
		const existing = acc.find((category) => category.key === source.categoryKey);
		if (existing) {
			existing.sources.push(source);
			return acc;
		}
		acc.push({
			key: source.categoryKey,
			label: source.categoryLabel,
			sources: [source],
		});
		return acc;
	}, []);

type DynamicSourceMenuHeaderProps = {
	isNested: boolean;
	title: string;
	onGoBack: () => void;
};

const DynamicSourceMenuHeader = ({
	isNested,
	title,
	onGoBack,
}: DynamicSourceMenuHeaderProps) => (
	<div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground border-b border-border/70 bg-muted/35">
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
		<span>{title}</span>
	</div>
);

type DynamicSourceCategoryListProps = {
	categories: CategoryBucket[];
	onSelectCategory: (categoryKey: string) => void;
};

const DynamicSourceCategoryList = ({
	categories,
	onSelectCategory,
}: DynamicSourceCategoryListProps) => (
	<div className="max-h-64 overflow-y-auto">
		{categories.length === 0 ? (
			<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
				No categories available
			</DropdownMenuItem>
		) : null}
		{categories.map((category) => (
			<DropdownMenuItem
				key={category.key}
				className="h-11 rounded-xl text-base flex items-center justify-between"
				onSelect={(event) => {
					event.preventDefault();
					onSelectCategory(category.key);
				}}
			>
				<span className="inline-flex items-center gap-2">
					<Database className="h-4 w-4" />
					{category.label}
				</span>
				<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
					{category.sources.length}
					<ChevronRight className="h-4 w-4" />
				</span>
			</DropdownMenuItem>
		))}
	</div>
);

type DynamicSourceListProps = {
	sources: DynamicSourceOption[];
	onSelectSource: (source: DynamicSourceOption) => void;
	onCreateSource?: () => void;
	createLabel?: string;
	emptyLabel?: string;
};

const DynamicSourceList = ({
	sources,
	onSelectSource,
	onCreateSource,
	createLabel = "Create dynamic source",
	emptyLabel = "No dynamic sources in this category",
}: DynamicSourceListProps) => (
	<div className="max-h-64 overflow-y-auto">
		{sources.length === 0 ? (
			<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
				{emptyLabel}
			</DropdownMenuItem>
		) : null}
		{sources.map((source) => (
			<DropdownMenuItem
				key={source.key}
				className="h-10 rounded-xl text-sm"
				onSelect={(event) => {
					event.preventDefault();
					onSelectSource(source);
				}}
			>
				<Database className="h-4 w-4" />
				<div className="flex flex-col gap-0.5">
					<span>{source.label}</span>
					{source.description && (
						<span className="text-[11px] text-muted-foreground">
							{source.description}
						</span>
					)}
				</div>
			</DropdownMenuItem>
		))}
		{onCreateSource ? (
			<>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="h-10 rounded-xl text-sm"
					onSelect={(event) => {
						event.preventDefault();
						onCreateSource();
					}}
				>
					<Plus className="h-4 w-4" />
					{createLabel}
				</DropdownMenuItem>
			</>
		) : null}
	</div>
);

type DynamicSourceTokenMenuProps = {
	tokenKey: string;
	sourceLabel: string;
	availableSources: DynamicSourceOption[];
	onSelectSource: (source: DynamicSourceOption) => void;
	onCreateSource: () => void;
	onRemoveSource: () => void;
};

export function DynamicSourceTokenMenu({
	tokenKey,
	sourceLabel,
	availableSources,
	onSelectSource,
	onCreateSource,
	onRemoveSource,
}: DynamicSourceTokenMenuProps) {
	const [open, setOpen] = useState(false);
	const [pageStack, setPageStack] = useState<MenuState[]>([ROOT_PAGE]);
	const categorizedSources = useMemo(
		() => buildCategoryBuckets(availableSources),
		[availableSources],
	);
	const currentState = pageStack[pageStack.length - 1] ?? ROOT_PAGE;
	const currentPage = currentState.page;
	const isNested = pageStack.length > 1;
	const activeCategory = categorizedSources.find(
		(category) => category.key === currentState.categoryKey,
	);
	const visibleSources = activeCategory?.sources ?? [];

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setPageStack([ROOT_PAGE]);
		}
	};

	const goToPage = (state: MenuState) => {
		setPageStack((prev) => [...prev, state]);
	};

	const goBack = () => {
		setPageStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
	};

	const title =
		currentPage === "category-list"
			? "Choose category"
			: currentPage === "source-list"
				? activeCategory?.label || "Choose dynamic source"
				: `Dynamic source › ${sourceLabel}`;

	return (
		<span
			contentEditable={false}
			data-dynamic-token-key={tokenKey}
			className="inline-flex align-middle mx-0.5"
		>
			<DropdownMenu open={open} onOpenChange={handleOpenChange}>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900 hover:bg-sky-200/60"
						onMouseDown={(event) => event.preventDefault()}
						title={`Dynamic source: ${tokenKey}`}
					>
						<Database className="h-3 w-3" />
						{sourceLabel}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					sideOffset={8}
					className="w-[280px] rounded-2xl p-0 overflow-hidden"
				>
					<DynamicSourceMenuHeader isNested={isNested} title={title} onGoBack={goBack} />
					<div className="p-1.5">
						{currentPage === "root" ? (
							<>
								<DropdownMenuItem
									className="h-11 rounded-xl text-base flex items-center justify-between"
									onSelect={(event) => {
										event.preventDefault();
										goToPage({ page: "category-list" });
									}}
								>
									<span className="inline-flex items-center gap-2">
										<Database className="h-4 w-4" />
										Edit value
									</span>
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									className="h-11 rounded-xl text-base"
									onSelect={(event) => {
										event.preventDefault();
										onRemoveSource();
									}}
								>
									<Trash2 className="h-4 w-4" />
									Remove dynamic source
								</DropdownMenuItem>
							</>
						) : currentPage === "category-list" ? (
							<DynamicSourceCategoryList
								categories={categorizedSources}
								onSelectCategory={(categoryKey) =>
									goToPage({ page: "source-list", categoryKey })
								}
							/>
						) : (
							<DynamicSourceList
								sources={visibleSources}
								onSelectSource={onSelectSource}
								onCreateSource={onCreateSource}
							/>
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}

type DynamicSourceInsertMenuProps = {
	availableSources: DynamicSourceOption[];
	placeholders: PlaceholderOption[];
	onSelectSource: (source: DynamicSourceOption) => void;
	onInsertPlaceholder: (placeholderKey: string) => void;
	onCreatePlaceholder: () => PlaceholderOption | null;
};

export function DynamicSourceInsertMenu({
	availableSources,
	placeholders,
	onSelectSource,
	onInsertPlaceholder,
	onCreatePlaceholder,
}: DynamicSourceInsertMenuProps) {
	const [open, setOpen] = useState(false);
	const [pageStack, setPageStack] = useState<MenuState[]>([ROOT_PAGE]);
	const categorizedSources = useMemo(
		() => buildCategoryBuckets(availableSources),
		[availableSources],
	);
	const currentState = pageStack[pageStack.length - 1] ?? ROOT_PAGE;
	const currentPage = currentState.page;
	const isNested = pageStack.length > 1;
	const activeCategory = categorizedSources.find(
		(category) => category.key === currentState.categoryKey,
	);
	const visibleSources = activeCategory?.sources ?? [];

	const closeMenu = () => {
		setOpen(false);
		setPageStack([ROOT_PAGE]);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setPageStack([ROOT_PAGE]);
		}
	};

	const goToPage = (state: MenuState) => {
		setPageStack((prev) => [...prev, state]);
	};

	const goBack = () => {
		setPageStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
	};

	const title =
		currentPage === "category-list"
			? "Choose category"
			: currentPage === "source-list"
				? activeCategory?.label || "Choose dynamic source"
				: currentPage === "placeholder-list"
					? "Template placeholders"
					: "Insert placeholder";

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" title="Insert placeholder">
					<Braces className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 rounded-2xl p-0 overflow-hidden">
				<DynamicSourceMenuHeader isNested={isNested} title={title} onGoBack={goBack} />
				<div className="p-1.5">
					{currentPage === "root" ? (
						<>
							<DropdownMenuItem
								className="h-11 rounded-xl text-base flex items-center justify-between"
								onSelect={(event) => {
									event.preventDefault();
									goToPage({ page: "category-list" });
								}}
							>
								<span className="inline-flex items-center gap-2">
									<Database className="h-4 w-4" />
									Dynamic sources
								</span>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</DropdownMenuItem>
							<DropdownMenuItem
								className="h-11 rounded-xl text-base flex items-center justify-between"
								onSelect={(event) => {
									event.preventDefault();
									goToPage({ page: "placeholder-list" });
								}}
							>
								<span className="inline-flex items-center gap-2">
									<Braces className="h-4 w-4" />
									Template placeholders
								</span>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</DropdownMenuItem>
						</>
					) : currentPage === "category-list" ? (
						<DynamicSourceCategoryList
							categories={categorizedSources}
							onSelectCategory={(categoryKey) =>
								goToPage({ page: "source-list", categoryKey })
							}
						/>
					) : currentPage === "source-list" ? (
						<DynamicSourceList
							sources={visibleSources}
							onSelectSource={(source) => {
								onSelectSource(source);
								closeMenu();
							}}
						/>
					) : (
						<div className="max-h-64 overflow-y-auto">
							{placeholders.length === 0 ? (
								<DropdownMenuItem disabled className="h-10 rounded-xl text-sm">
									No placeholders yet
								</DropdownMenuItem>
							) : null}
							{placeholders.map((placeholder) => (
								<DropdownMenuItem
									key={placeholder.id}
									className="h-10 rounded-xl text-sm"
									onSelect={(event) => {
										event.preventDefault();
										onInsertPlaceholder(placeholder.key);
										closeMenu();
									}}
								>
									{placeholder.label?.trim() || placeholder.key}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="h-10 rounded-xl text-sm"
								onSelect={(event) => {
									event.preventDefault();
									const created = onCreatePlaceholder();
									if (!created) return;
									onInsertPlaceholder(created.key);
									closeMenu();
								}}
							>
								<Plus className="h-4 w-4" />
								Create placeholder
							</DropdownMenuItem>
						</div>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

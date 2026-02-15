import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TemplateElement } from "@/core";
import type { IconName } from "lucide-react/dynamic";
import { DynamicIcon, iconNames, normalizeIconName, formatIconNameForDisplay } from "./lucide-icon-map";
import { typography, components, separators } from "../design-system";
import { cn } from "@/lib/utils";

const ICON_NAMES_SORTED = [...iconNames].sort();

interface IconElementProps {
	element: Extract<TemplateElement, { type: "icon" }>;
}

export default function IconElement({ element }: IconElementProps) {
	const name = normalizeIconName(element.iconName) as IconName;
	return (
		<div
			className="w-full h-full flex items-center justify-center"
			style={{ color: element.color }}
		>
			<DynamicIcon name={name} className="w-full h-full" style={{ minWidth: 16, minHeight: 16 }} />
		</div>
	);
}

interface IconPropertiesProps {
	element: Extract<TemplateElement, { type: "icon" }>;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}

export function IconProperties({ element, onChange, isNarrow }: IconPropertiesProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const displayName = normalizeIconName(element.iconName);
	const filteredNames = useMemo(() => {
		if (!search.trim()) return ICON_NAMES_SORTED;
		const q = search.toLowerCase();
		return ICON_NAMES_SORTED.filter((name) => name.toLowerCase().includes(q));
	}, [search]);

	const common = (
		<section className={`${components.section} ${separators.subsectionDivider}`}>
			<h4 className={typography.subsectionTitle}>{t("designer.elementProperties.common.positionAndSize")}</h4>
			<div className={isNarrow ? components.gridNarrow : components.grid}>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.x")}</Label>
					<Input
						type="number"
						value={element.x}
						onChange={(e) => onChange({ x: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.y")}</Label>
					<Input
						type="number"
						value={element.y}
						onChange={(e) => onChange({ y: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.width")}</Label>
					<Input
						type="number"
						value={element.width}
						onChange={(e) => onChange({ width: Number(e.target.value) })}
						className={components.inputHeight}
					/>
				</div>
				<div className={components.field}>
					<Label className={typography.fieldLabel}>{t("designer.elementProperties.common.height")}</Label>
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
			<h3 className={typography.sectionTitle}>{t("designer.elementProperties.icon.title", "Icon")}</h3>
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t("designer.elementProperties.icon.icon", "Icon")}</h4>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className={cn("w-full justify-between", components.inputHeight)}
						>
							<span className="flex items-center gap-2 truncate">
								<DynamicIcon name={displayName as IconName} className="h-4 w-4 shrink-0" />
								{formatIconNameForDisplay(displayName)}
							</span>
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[280px] p-0" align="start">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={t("designer.elementProperties.icon.searchPlaceholder", "Search icons...")}
								value={search}
								onValueChange={setSearch}
							/>
							<CommandList>
								<CommandEmpty>{t("designer.elementProperties.icon.noResults", "No icon found.")}</CommandEmpty>
								<CommandGroup>
									{filteredNames.map((name) => (
										<CommandItem
											key={name}
											value={name}
											onSelect={() => {
												onChange({ iconName: name });
												setOpen(false);
												setSearch("");
											}}
										>
											<DynamicIcon name={name as IconName} className="h-4 w-4 shrink-0 mr-2" />
											{formatIconNameForDisplay(name)}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</section>
			<section className={components.subsection}>
				<h4 className={typography.subsectionTitle}>{t("designer.elementProperties.icon.color", "Color")}</h4>
				<div className="flex items-center gap-2">
					<Input
						type="text"
						value={element.color}
						onChange={(e) => onChange({ color: e.target.value })}
						className={components.inputHeight}
					/>
					<input
						type="color"
						value={element.color}
						onChange={(e) => onChange({ color: e.target.value })}
						className="h-9 w-9 rounded border cursor-pointer"
					/>
				</div>
			</section>
			{common}
		</div>
	);
}

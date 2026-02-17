import { useTranslation } from "react-i18next";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type MissingRequiredField = {
	binding: string;
	label: string;
	description?: string;
	elementType: "text" | "input" | "table" | "currency";
};

type MissingRequiredFieldsPanelProps = {
	fields: MissingRequiredField[];
	onAddRequiredElement: (
		binding: string,
		label: string,
		elementType: "text" | "input" | "table" | "currency",
	) => void;
	title?: string;
	showIcon?: boolean;
	showToast?: boolean;
	variant?: "card" | "embedded";
	className?: string;
};

export function MissingRequiredFieldsPanel({
	fields,
	onAddRequiredElement,
	title,
	showIcon = true,
	showToast = true,
	variant = "card",
	className,
}: MissingRequiredFieldsPanelProps) {
	const { t } = useTranslation();

	if (fields.length === 0) return null;

	const resolvedTitle = title ?? t("designer.sidebar.requiredFields");
	const isEmbedded = variant === "embedded";

	return (
		<div
			className={cn(
				isEmbedded
					? "text-xs"
					: "mt-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/20",
				className,
			)}
		>
			<div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
				{showIcon && <Lock className="h-3.5 w-3.5" />}
				{resolvedTitle}
			</div>
			<ul className="divide-y divide-amber-200/80 dark:divide-amber-800/60">
				{fields.map((field) => (
					<li key={field.binding} className="py-1 first:pt-0 last:pb-0">
						<button
							type="button"
							onClick={() => {
								onAddRequiredElement(
									field.binding,
									field.label,
									field.elementType,
								);
								if (showToast) {
									toast.success(
										t("designer.sidebar.addedField", {
											label: field.label,
										}),
										{ duration: 2000 },
									);
								}
							}}
							className={cn(
								"group w-full rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
								isEmbedded
									? "hover:bg-amber-100/60 dark:hover:bg-amber-900/25"
									: "hover:bg-amber-100/80 dark:hover:bg-amber-900/40",
							)}
						>
							<div className="flex min-w-0 items-start gap-2">
								<Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
								<div className="min-w-0">
									<div className="break-words text-xs font-semibold leading-snug text-amber-900 dark:text-amber-200">
										{field.label}
									</div>
									{field.description && (
										<div className="mt-0.5 whitespace-normal break-words text-[11px] font-normal leading-relaxed text-amber-700/80 dark:text-amber-400/80">
											{field.description}
										</div>
									)}
								</div>
							</div>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

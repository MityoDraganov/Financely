import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WIDGET_TEMPLATES } from "@/core/widget-templates";

export type TemplateOption =
	| { kind: "blank" }
	| { kind: "template"; template: (typeof WIDGET_TEMPLATES)[number] };

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
	contact: "Name, email, phone & message fields",
	quote: "Budget range & project details",
	invoice: "Company, billing address & VAT",
};

const TEMPLATE_ACCENTS: Record<string, { color: string; gradFrom: string; gradTo: string }> = {
	contact: { color: "#6366f1", gradFrom: "#6366f1", gradTo: "#a5b4fc" },
	quote:   { color: "#10b981", gradFrom: "#10b981", gradTo: "#6ee7b7" },
	invoice: { color: "#0ea5e9", gradFrom: "#0ea5e9", gradTo: "#7dd3fc" },
};

function TemplateIllustration({ id, color, gradFrom, gradTo }: { id: string; color: string; gradFrom: string; gradTo: string }) {
	const gradId = `wgrad-${id}`;
	const gradId2 = `wgrad2-${id}`;

	if (id === "blank") {
		return (
			<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#94a3b8" stopOpacity="0.12" />
						<stop offset="100%" stopColor="#94a3b8" stopOpacity="0.04" />
					</linearGradient>
				</defs>
				<rect width="140" height="96" rx="8" fill={`url(#${gradId})`} />
				<rect x="10" y="10" width="120" height="76" rx="5" fill="white" fillOpacity="0.6" />
				{/* dashed outline doc */}
				<rect x="30" y="20" width="80" height="56" rx="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
				{/* plus */}
				<line x1="70" y1="40" x2="70" y2="56" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
				<line x1="62" y1="48" x2="78" y2="48" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
			</svg>
		);
	}

	if (id === "contact") {
		return (
			<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor={gradFrom} stopOpacity="0.18" />
						<stop offset="100%" stopColor={gradTo} stopOpacity="0.06" />
					</linearGradient>
					<linearGradient id={gradId2} x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor={gradFrom} />
						<stop offset="100%" stopColor={gradTo} />
					</linearGradient>
				</defs>
				<rect width="140" height="96" rx="8" fill={`url(#${gradId})`} />
				<rect x="10" y="10" width="120" height="76" rx="5" fill="white" fillOpacity="0.72" />
				<rect x="10" y="10" width="120" height="16" rx="5" fill={`url(#${gradId2})`} />
				<circle cx="20" cy="18" r="2.5" fill="white" fillOpacity="0.8" />
				{/* contact person icon */}
				<circle cx="70" cy="30" r="5" fill={color} fillOpacity="0.4" />
				<path d="M58 42 Q70 36 82 42" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
				{/* form lines */}
				<rect x="20" y="50" width="100" height="3" rx="1.5" fill={color} fillOpacity="0.18" />
				<rect x="20" y="57" width="80" height="3" rx="1.5" fill={color} fillOpacity="0.18" />
				<rect x="20" y="64" width="90" height="3" rx="1.5" fill={color} fillOpacity="0.18" />
				<rect x="88" y="74" width="32" height="9" rx="3" fill={color} fillOpacity="0.55" />
			</svg>
		);
	}

	if (id === "quote") {
		return (
			<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor={gradFrom} stopOpacity="0.18" />
						<stop offset="100%" stopColor={gradTo} stopOpacity="0.06" />
					</linearGradient>
					<linearGradient id={gradId2} x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor={gradFrom} />
						<stop offset="100%" stopColor={gradTo} />
					</linearGradient>
				</defs>
				<rect width="140" height="96" rx="8" fill={`url(#${gradId})`} />
				<rect x="10" y="10" width="120" height="76" rx="5" fill="white" fillOpacity="0.72" />
				<rect x="10" y="10" width="120" height="16" rx="5" fill={`url(#${gradId2})`} />
				<circle cx="20" cy="18" r="2.5" fill="white" fillOpacity="0.8" />
				{/* dollar sign */}
				<text x="18" y="36" fontSize="12" fontWeight="700" fill={color} fillOpacity="0.55">$</text>
				<rect x="30" y="28" width="50" height="4" rx="2" fill={color} fillOpacity="0.5" />
				<rect x="20" y="40" width="100" height="3" rx="1.5" fill={color} fillOpacity="0.18" />
				<rect x="20" y="47" width="80" height="3" rx="1.5" fill={color} fillOpacity="0.18" />
				{/* select box */}
				<rect x="20" y="55" width="100" height="10" rx="3" fill={color} fillOpacity="0.1" stroke={color} strokeOpacity="0.25" strokeWidth="0.8" />
				<rect x="22" y="58" width="30" height="4" rx="2" fill={color} fillOpacity="0.3" />
				<path d="M115 58.5l2 3 2-3" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
				<rect x="88" y="72" width="32" height="9" rx="3" fill={color} fillOpacity="0.55" />
			</svg>
		);
	}

	// invoice
	return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			<defs>
				<linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor={gradFrom} stopOpacity="0.18" />
					<stop offset="100%" stopColor={gradTo} stopOpacity="0.06" />
				</linearGradient>
				<linearGradient id={gradId2} x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor={gradFrom} />
					<stop offset="100%" stopColor={gradTo} />
				</linearGradient>
			</defs>
			<rect width="140" height="96" rx="8" fill={`url(#${gradId})`} />
			<rect x="10" y="10" width="120" height="76" rx="5" fill="white" fillOpacity="0.72" />
			<rect x="10" y="10" width="120" height="16" rx="5" fill={`url(#${gradId2})`} />
			<circle cx="20" cy="18" r="2.5" fill="white" fillOpacity="0.8" />
			<rect x="18" y="30" width="50" height="4" rx="2" fill={color} fillOpacity="0.55" />
			<rect x="18" y="38" width="100" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<rect x="18" y="43" width="86" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<rect x="18" y="48" width="92" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<line x1="18" y1="56" x2="122" y2="56" stroke={color} strokeOpacity="0.15" strokeWidth="1" />
			<rect x="80" y="59" width="42" height="18" rx="4" fill={color} fillOpacity="0.12" />
			<rect x="84" y="63" width="20" height="3" rx="1.5" fill={color} fillOpacity="0.4" />
			<rect x="84" y="69" width="30" height="4" rx="2" fill={color} fillOpacity="0.6" />
			<text x="22" y="71" fontSize="14" fontWeight="700" fill={color} fillOpacity="0.45">$</text>
		</svg>
	);
}

export type CreateWidgetDialogProps = {
	open: boolean;
	isPending: boolean;
	selectedOption: TemplateOption | null;
	onSelectedOptionChange: (option: TemplateOption) => void;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	onCancel: () => void;
};

const ALL_OPTIONS: Array<{ option: TemplateOption; label: string; description: string; id: string }> = [
	{
		option: { kind: "blank" },
		id: "blank",
		label: "Blank Widget",
		description: "Start from scratch with an empty canvas",
	},
	...WIDGET_TEMPLATES.map((t) => ({
		option: { kind: "template" as const, template: t },
		id: t.id,
		label: t.name,
		description: TEMPLATE_DESCRIPTIONS[t.id] ?? "",
	})),
];

export function CreateWidgetDialog({
	open,
	isPending,
	selectedOption,
	onSelectedOptionChange,
	onOpenChange,
	onConfirm,
	onCancel,
}: CreateWidgetDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl! w-full">
				<DialogHeader>
					<DialogTitle>Create Widget</DialogTitle>
					<DialogDescription>
						Start blank or pick a template to pre-fill your widget with common fields.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
					{ALL_OPTIONS.map(({ option, id, label, description }) => {
						const isSelected =
							selectedOption !== null &&
							(option.kind === "blank"
								? selectedOption.kind === "blank"
								: selectedOption.kind === "template" && selectedOption.template.id === id);

						const isBlank = id === "blank";
						const accent = isBlank
							? { color: "#64748b", gradFrom: "#94a3b8", gradTo: "#cbd5e1" }
							: TEMPLATE_ACCENTS[id] ?? { color: "#6366f1", gradFrom: "#6366f1", gradTo: "#a5b4fc" };

						return (
							<button
								key={id}
								type="button"
								onClick={() => onSelectedOptionChange(option)}
								className={[
									"group relative flex flex-col rounded-sm border overflow-hidden text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isSelected
										? "border-primary shadow-md ring-1 ring-primary/30"
										: "border-border/60 bg-background hover:border-border hover:shadow-sm",
								].join(" ")}
							>
								{/* Illustration area */}
								<div
									className="relative w-full overflow-hidden transition-all duration-300"
									style={{
										height: "100px",
										background: `linear-gradient(135deg, ${accent.gradFrom}18 0%, ${accent.gradTo}0a 100%)`,
									}}
								>
									<div className="absolute inset-0 flex items-center justify-center p-3">
										{isBlank ? (
											<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
												<defs>
													<linearGradient id="wgrad-blank" x1="0" y1="0" x2="1" y2="1">
														<stop offset="0%" stopColor="#94a3b8" stopOpacity="0.12" />
														<stop offset="100%" stopColor="#94a3b8" stopOpacity="0.04" />
													</linearGradient>
												</defs>
												<rect width="140" height="96" rx="8" fill="url(#wgrad-blank)" />
												<rect x="10" y="10" width="120" height="76" rx="5" fill="white" fillOpacity="0.6" />
												<rect x="30" y="20" width="80" height="56" rx="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
												<line x1="70" y1="40" x2="70" y2="56" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
												<line x1="62" y1="48" x2="78" y2="48" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
											</svg>
										) : (
											<TemplateIllustration
												id={id}
												color={accent.color}
												gradFrom={accent.gradFrom}
												gradTo={accent.gradTo}
											/>
										)}
									</div>
									{isSelected && (
										<span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
											<svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
												<path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
											</svg>
										</span>
									)}
									{!isBlank && (
										<span
											className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
											style={{ background: `${accent.gradFrom}22`, color: accent.color }}
										>
											Template
										</span>
									)}
								</div>

								{/* Text area */}
								<div className="flex flex-col gap-1 px-3 py-2.5">
									<p className="text-xs font-semibold text-foreground leading-tight">
										{label}
									</p>
									<p className="text-[10px] leading-snug text-muted-foreground">
										{description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel} disabled={isPending}>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={isPending || selectedOption === null}>
						{isPending ? "Creating..." : "Create widget"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

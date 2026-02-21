import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	EMAIL_TEMPLATE_TYPE_DEFINITIONS,
	type EmailTemplateTypeId,
} from "@/utils/email-template-compatibility";

// Per-type accent palettes
const TEMPLATE_TYPE_ACCENTS: Record<
	EmailTemplateTypeId,
	{ color: string; colorAlt: string; gradFrom: string; gradTo: string; label: string }
> = {
	all:               { color: "#6366f1", colorAlt: "#818cf8", gradFrom: "#6366f1", gradTo: "#a5b4fc", label: "Universal" },
	invoice:           { color: "#0ea5e9", colorAlt: "#38bdf8", gradFrom: "#0ea5e9", gradTo: "#7dd3fc", label: "Invoice" },
	proposal:          { color: "#10b981", colorAlt: "#34d399", gradFrom: "#10b981", gradTo: "#6ee7b7", label: "Proposal" },
	workflow_invoice:  { color: "#f59e0b", colorAlt: "#fbbf24", gradFrom: "#f59e0b", gradTo: "#fde68a", label: "Workflow" },
	workflow_proposal: { color: "#8b5cf6", colorAlt: "#a78bfa", gradFrom: "#8b5cf6", gradTo: "#c4b5fd", label: "Workflow" },
	workflow_contact:  { color: "#ec4899", colorAlt: "#f472b6", gradFrom: "#ec4899", gradTo: "#fbcfe8", label: "Workflow" },
	workflow_product:  { color: "#f97316", colorAlt: "#fb923c", gradFrom: "#f97316", gradTo: "#fed7aa", label: "Workflow" },
};

type AccentValue = typeof TEMPLATE_TYPE_ACCENTS[EmailTemplateTypeId];

function TemplateIllustration({ id, accent }: { id: EmailTemplateTypeId; accent: AccentValue }) {
	const { color, colorAlt, gradFrom, gradTo } = accent;
	const gradId = `grad-${id}`;
	const gradId2 = `grad2-${id}`;

	const shared = (
		<>
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
			<circle cx="28" cy="18" r="2.5" fill="white" fillOpacity="0.55" />
			<circle cx="36" cy="18" r="2.5" fill="white" fillOpacity="0.35" />
		</>
	);

	if (id === "all") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="16" y="32" width="50" height="22" rx="3" fill={color} fillOpacity="0.13" />
			<rect x="74" y="32" width="50" height="22" rx="3" fill={colorAlt} fillOpacity="0.13" />
			<rect x="16" y="58" width="50" height="22" rx="3" fill={colorAlt} fillOpacity="0.13" />
			<rect x="74" y="58" width="50" height="22" rx="3" fill={color} fillOpacity="0.13" />
			<rect x="20" y="36" width="12" height="10" rx="2" fill={color} fillOpacity="0.5" />
			<rect x="78" y="36" width="12" height="10" rx="2" fill={colorAlt} fillOpacity="0.5" />
			<rect x="20" y="62" width="12" height="10" rx="2" fill={colorAlt} fillOpacity="0.5" />
			<rect x="78" y="62" width="12" height="10" rx="2" fill={color} fillOpacity="0.5" />
			<rect x="36" y="38" width="24" height="3" rx="1.5" fill={color} fillOpacity="0.4" />
			<rect x="36" y="44" width="18" height="2.5" rx="1.25" fill={color} fillOpacity="0.2" />
			<rect x="94" y="38" width="24" height="3" rx="1.5" fill={colorAlt} fillOpacity="0.4" />
			<rect x="94" y="44" width="18" height="2.5" rx="1.25" fill={colorAlt} fillOpacity="0.2" />
		</svg>
	);

	if (id === "invoice") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="18" y="30" width="60" height="4" rx="2" fill={color} fillOpacity="0.55" />
			<rect x="18" y="38" width="104" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<rect x="18" y="43" width="90" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<rect x="18" y="48" width="96" height="2.5" rx="1.25" fill={color} fillOpacity="0.18" />
			<line x1="18" y1="55" x2="122" y2="55" stroke={color} strokeOpacity="0.15" strokeWidth="1" />
			<rect x="80" y="58" width="42" height="18" rx="4" fill={color} fillOpacity="0.12" />
			<rect x="84" y="62" width="20" height="3" rx="1.5" fill={color} fillOpacity="0.4" />
			<rect x="84" y="68" width="30" height="4" rx="2" fill={color} fillOpacity="0.6" />
			<text x="22" y="70" fontSize="14" fontWeight="700" fill={color} fillOpacity="0.45">$</text>
		</svg>
	);

	if (id === "proposal") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="18" y="30" width="70" height="4.5" rx="2.25" fill={color} fillOpacity="0.6" />
			<rect x="18" y="39" width="104" height="2.5" rx="1.25" fill={color} fillOpacity="0.2" />
			<rect x="18" y="44" width="88" height="2.5" rx="1.25" fill={color} fillOpacity="0.2" />
			<rect x="18" y="49" width="96" height="2.5" rx="1.25" fill={color} fillOpacity="0.2" />
			<rect x="18" y="56" width="6" height="6" rx="1.5" fill={color} fillOpacity="0.3" />
			<rect x="28" y="58" width="40" height="2.5" rx="1.25" fill={color} fillOpacity="0.25" />
			<rect x="18" y="65" width="6" height="6" rx="1.5" fill={color} fillOpacity="0.55" />
			<path d="M19.5 68l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
			<rect x="28" y="67" width="52" height="2.5" rx="1.25" fill={color} fillOpacity="0.25" />
		</svg>
	);

	const workflowNodes = (
		<>
			<circle cx="32" cy="50" r="10" fill={color} fillOpacity="0.15" />
			<circle cx="32" cy="50" r="5" fill={color} fillOpacity="0.5" />
			<line x1="42" y1="50" x2="58" y2="50" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 2" />
			<polygon points="58,47 63,50 58,53" fill={color} fillOpacity="0.45" />
			<rect x="63" y="41" width="18" height="18" rx="4" fill={color} fillOpacity="0.15" />
			<rect x="67" y="45" width="10" height="10" rx="2" fill={color} fillOpacity="0.5" />
			<line x1="81" y1="50" x2="97" y2="50" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 2" />
			<polygon points="97,47 102,50 97,53" fill={color} fillOpacity="0.45" />
			<circle cx="110" cy="50" r="10" fill={color} fillOpacity="0.15" />
			<circle cx="110" cy="50" r="5" fill={color} fillOpacity="0.5" />
		</>
	);

	if (id === "workflow_invoice") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="20" y="29" width="22" height="8" rx="2.5" fill={color} fillOpacity="0.55" />
			<rect x="47" y="30" width="50" height="4" rx="2" fill={color} fillOpacity="0.25" />
			{workflowNodes}
			<rect x="18" y="64" width="104" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
			<rect x="18" y="69" width="70" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
		</svg>
	);

	if (id === "workflow_proposal") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="20" y="29" width="22" height="8" rx="2.5" fill={color} fillOpacity="0.55" />
			<rect x="47" y="30" width="50" height="4" rx="2" fill={color} fillOpacity="0.25" />
			{workflowNodes}
			<rect x="18" y="64" width="104" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
			<rect x="18" y="69" width="55" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
		</svg>
	);

	if (id === "workflow_contact") return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="20" y="29" width="22" height="8" rx="2.5" fill={color} fillOpacity="0.55" />
			<rect x="47" y="30" width="50" height="4" rx="2" fill={color} fillOpacity="0.25" />
			{workflowNodes}
			<circle cx="110" cy="47" r="3" fill="white" fillOpacity="0.7" />
			<path d="M106 55 Q110 52 114 55" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
			<rect x="18" y="64" width="80" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
			<rect x="18" y="69" width="60" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
		</svg>
	);

	// workflow_product
	return (
		<svg viewBox="0 0 140 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
			{shared}
			<rect x="20" y="29" width="22" height="8" rx="2.5" fill={color} fillOpacity="0.55" />
			<rect x="47" y="30" width="50" height="4" rx="2" fill={color} fillOpacity="0.25" />
			{workflowNodes}
			<rect x="106" y="46" width="8" height="8" rx="1.5" fill="white" fillOpacity="0.65" />
			<line x1="106" y1="49" x2="114" y2="49" stroke={color} strokeOpacity="0.5" strokeWidth="0.8" />
			<rect x="18" y="64" width="90" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
			<rect x="18" y="69" width="65" height="2.5" rx="1.25" fill={color} fillOpacity="0.15" />
		</svg>
	);
}

export type CreateEmailTemplateDialogProps = {
	open: boolean;
	isPending: boolean;
	selectedTemplateType: EmailTemplateTypeId;
	onSelectedTemplateTypeChange: (type: EmailTemplateTypeId) => void;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	onCancel: () => void;
};

export function CreateEmailTemplateDialog({
	open,
	isPending,
	selectedTemplateType,
	onSelectedTemplateTypeChange,
	onOpenChange,
	onConfirm,
	onCancel,
}: CreateEmailTemplateDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-7xl! w-full">
				<DialogHeader>
					<DialogTitle>Create Email Template</DialogTitle>
					<DialogDescription>
						Select a template type first. This controls which dynamic sources are available.
					</DialogDescription>
				</DialogHeader>
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
					{EMAIL_TEMPLATE_TYPE_DEFINITIONS.map((templateType) => {
						const isSelected = selectedTemplateType === templateType.id;
						const accent = TEMPLATE_TYPE_ACCENTS[templateType.id];
						return (
							<button
								key={templateType.id}
								type="button"
								onClick={() => onSelectedTemplateTypeChange(templateType.id)}
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
										height: "120px",
										background: `linear-gradient(135deg, ${accent.gradFrom}18 0%, ${accent.gradTo}0a 100%)`,
									}}
								>
									<div className="absolute inset-0 flex items-center justify-center p-3">
										<TemplateIllustration id={templateType.id} accent={accent} />
									</div>
									{isSelected && (
										<span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-sm">
											<svg className="h-3 w-3 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
												<path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
											</svg>
										</span>
									)}
									<span
										className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
										style={{ background: `${accent.gradFrom}22`, color: accent.color }}
									>
										{accent.label}
									</span>
								</div>

								{/* Text area */}
								<div className="flex flex-col gap-1 px-3 py-2.5">
									<p className="text-xs font-semibold text-foreground leading-tight">
										{templateType.label}
									</p>
									<p className="text-[10px] leading-snug text-muted-foreground">
										{templateType.description}
									</p>
									<p className="mt-0.5 text-[10px] font-medium" style={{ color: accent.color }}>
										{templateType.entities.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" · ")}
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
					<Button onClick={onConfirm} disabled={isPending}>
						{isPending ? "Creating..." : "Create template"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

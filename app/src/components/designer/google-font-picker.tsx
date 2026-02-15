import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	fetchGoogleFontsCatalog,
	GOOGLE_FONT_CATEGORIES,
	GOOGLE_FONT_OPTIONS,
	type GoogleFontCategory,
	loadGoogleFonts,
} from "@/utils/google-fonts";

type GoogleFontPickerProps = {
	value: string | undefined;
	onChange: (fontFamily: string) => void;
	label?: string;
	title?: string;
	sampleText?: string;
};

const DEFAULT_SAMPLE_TEXT = "The quick brown fox jumps over 123";

export function GoogleFontPicker({
	value,
	onChange,
	label = "Font Family",
	title = "Choose Font",
	sampleText = DEFAULT_SAMPLE_TEXT,
}: GoogleFontPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<"all" | GoogleFontCategory>("all");
	const [showPopularOnly, setShowPopularOnly] = useState(false);
	const [fontOptions, setFontOptions] = useState(GOOGLE_FONT_OPTIONS);

	const currentValue = value?.trim() || "Inter";

	const filteredFonts = useMemo(() => {
		const q = query.trim().toLowerCase();
		return fontOptions.filter((font) => {
			if (category !== "all" && font.category !== category) return false;
			if (showPopularOnly && !font.popular) return false;
			if (q.length > 0 && !font.family.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [category, query, showPopularOnly, fontOptions]);

	const groupedFonts = useMemo(() => {
		if (category !== "all") {
			const selected = GOOGLE_FONT_CATEGORIES.find((item) => item.value === category);
			return [
				{
					key: category,
					label: selected?.label || category,
					items: filteredFonts,
				},
			];
		}

		return GOOGLE_FONT_CATEGORIES
			.filter((entry) => entry.value !== "all")
			.map((entry) => ({
				key: entry.value,
				label: entry.label,
				items: filteredFonts.filter((font) => font.category === entry.value),
			}))
			.filter((group) => group.items.length > 0);
	}, [category, filteredFonts]);

	useEffect(() => {
		if (!open) return;
		const preload = filteredFonts.slice(0, 40).map((font) => font.family);
		loadGoogleFonts([currentValue, ...preload]);
	}, [open, filteredFonts, currentValue]);

	useEffect(() => {
		if (!open) return;
		let active = true;
		void fetchGoogleFontsCatalog().then((catalog) => {
			if (!active) return;
			setFontOptions(catalog);
		});
		return () => {
			active = false;
		};
	}, [open]);

	return (
		<div className="space-y-2">
			<Label className="text-xs font-medium text-foreground">{label}</Label>
			<Button
				type="button"
				variant="outline"
				className="w-full justify-between h-9 text-xs"
				onClick={() => setOpen(true)}
			>
				<span style={{ fontFamily: currentValue }}>{currentValue}</span>
				<SlidersHorizontal className="h-3.5 w-3.5 opacity-70" />
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-6xl w-[min(96vw,1150px)] h-[82vh] p-0 overflow-hidden flex flex-col">
					<DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>

					<div className="px-6 py-4 border-b border-border space-y-3">
						<div className="relative">
							<Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
							<Input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search Google Fonts..."
								className="pl-9 h-10"
							/>
						</div>

						<div className="flex gap-3 flex-wrap items-center">
							<div className="w-48">
								<Select
									value={category}
									onValueChange={(value) => setCategory(value as "all" | GoogleFontCategory)}
								>
									<SelectTrigger className="h-9">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{GOOGLE_FONT_CATEGORIES.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button
								type="button"
								variant={showPopularOnly ? "default" : "outline"}
								className="h-9"
								onClick={() => setShowPopularOnly((prev) => !prev)}
							>
								Popular Only
							</Button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-6 space-y-6">
						{groupedFonts.map((group) => (
							<section key={group.key} className="space-y-3">
								<div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
									{group.label}
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
									{group.items.map((font) => {
										const active = currentValue === font.family;
										return (
											<button
												key={font.family}
												type="button"
												className={`text-left rounded-lg border p-4 transition-colors ${
													active
														? "border-primary bg-primary/5"
														: "border-border hover:border-primary/50 hover:bg-accent/40"
												}`}
												onMouseEnter={() => loadGoogleFonts([font.family])}
												onFocus={() => loadGoogleFonts([font.family])}
												onClick={() => {
													loadGoogleFonts([font.family]);
													onChange(font.family);
													setOpen(false);
												}}
											>
												<div className="flex items-center justify-between gap-2 mb-2">
													<div className="text-sm font-semibold truncate">{font.family}</div>
													{font.popular ? (
														<div className="text-[10px] uppercase tracking-wide text-primary font-semibold">
															Popular
														</div>
													) : null}
												</div>
												<div
													className="text-sm text-foreground/90 leading-snug"
													style={{ fontFamily: font.family }}
												>
													{sampleText}
												</div>
											</button>
										);
									})}
								</div>
							</section>
						))}
						{filteredFonts.length === 0 ? (
							<div className="text-sm text-muted-foreground py-8">No fonts match your filters.</div>
						) : null}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

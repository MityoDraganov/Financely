export type TableTextBehaviorMode =
	| "wrap"
	| "nowrap"
	| "break-words"
	| "ellipsis"
	| "clamp";

export type TableTextBehavior = {
	mode: TableTextBehaviorMode;
	clampLines?: number;
};

const VALID_MODES: TableTextBehaviorMode[] = [
	"wrap",
	"nowrap",
	"break-words",
	"ellipsis",
	"clamp",
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object";
}

function clampLines(value: unknown): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return 2;
	return Math.max(1, Math.min(10, Math.round(parsed)));
}

export function normalizeTableTextBehavior(
	value: unknown,
	fallback: TableTextBehaviorMode = "wrap"
): TableTextBehavior {
	if (!isRecord(value)) {
		return { mode: fallback };
	}
	const rawMode = typeof value.mode === "string" ? value.mode : "";
	const mode = VALID_MODES.includes(rawMode as TableTextBehaviorMode)
		? (rawMode as TableTextBehaviorMode)
		: fallback;
	if (mode === "clamp") {
		return { mode, clampLines: clampLines(value.clampLines) };
	}
	return { mode };
}

export function getTableTextBehaviorInlineCss(behavior: TableTextBehavior): string {
	const base = "display:block;width:100%;max-width:100%;min-width:0;";
	switch (behavior.mode) {
		case "nowrap":
			return `${base}white-space:nowrap;overflow:hidden;text-overflow:clip;`;
		case "break-words":
			return `${base}white-space:normal;word-break:normal;overflow-wrap:anywhere;`;
		case "ellipsis":
			return `${base}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
		case "clamp":
			return `${base}display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${behavior.clampLines ?? 2};overflow:hidden;white-space:normal;word-break:normal;overflow-wrap:anywhere;`;
		case "wrap":
		default:
			return `${base}white-space:normal;word-break:normal;overflow-wrap:normal;`;
	}
}

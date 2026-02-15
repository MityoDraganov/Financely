import type React from "react";

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

export function getTableTextBehaviorStyles(
	behavior: TableTextBehavior
): React.CSSProperties {
	const base: React.CSSProperties = {
		display: "block",
		width: "100%",
		maxWidth: "100%",
		minWidth: 0,
	};

	switch (behavior.mode) {
		case "nowrap":
			return {
				...base,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "clip",
			};
		case "break-words":
			return {
				...base,
				whiteSpace: "normal",
				wordBreak: "normal",
				overflowWrap: "anywhere",
			};
		case "ellipsis":
			return {
				...base,
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			};
		case "clamp":
			return {
				...base,
				display: "-webkit-box",
				WebkitBoxOrient: "vertical",
				WebkitLineClamp: behavior.clampLines ?? 2,
				overflow: "hidden",
				whiteSpace: "normal",
				wordBreak: "normal",
				overflowWrap: "anywhere",
			};
		case "wrap":
		default:
			return {
				...base,
				whiteSpace: "normal",
				wordBreak: "normal",
				overflowWrap: "normal",
			};
	}
}

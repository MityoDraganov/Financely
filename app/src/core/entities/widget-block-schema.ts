/**
 * Block-based schema for modular widgets. Each block has id, type, props, and optional children.
 */

export const LAYOUT_BLOCK_TYPES = [
	"container",
	"card",
	"sectionHeader",
	"columns",
	"divider",
	"spacer",
] as const;
export const CONTENT_BLOCK_TYPES = ["paragraph"] as const;
export const INPUT_BLOCK_TYPES = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"checkbox",
	"date",
	"file",
] as const;
export const ACTION_BLOCK_TYPES = ["submitButton", "successBlock"] as const;

export type LayoutBlockType = (typeof LAYOUT_BLOCK_TYPES)[number];
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];
export type InputBlockType = (typeof INPUT_BLOCK_TYPES)[number];
export type ActionBlockType = (typeof ACTION_BLOCK_TYPES)[number];

export type BlockType =
	| LayoutBlockType
	| ContentBlockType
	| InputBlockType
	| ActionBlockType;

/** Props common to layout blocks that have children */
export interface LayoutBlockProps {
	columns?: 1 | 2;
}

/** Section header: title + optional description */
export interface SectionHeaderProps {
	title: string;
	description?: string;
}

/** Paragraph / content text */
export interface ParagraphProps {
	content: string;
}

/** Input-like blocks: label, required, placeholder, fieldKey for data mapping */
export interface InputBlockProps {
	label: string;
	required?: boolean;
	placeholder?: string;
	fieldKey: string;
	helperText?: string;
}

export type SelectInputOption =
	| string
	| {
			label: string;
			value: string;
	  };

export interface SelectInputProps extends InputBlockProps {
	options: SelectInputOption[];
}

export interface SuccessBlockProps {
	message: string;
	redirectUrl?: string;
	redirectButtonText?: string;
}

export interface SubmitButtonProps {
	label: string;
}

export type BlockProps =
	| LayoutBlockProps
	| SectionHeaderProps
	| ParagraphProps
	| InputBlockProps
	| SelectInputProps
	| SuccessBlockProps
	| SubmitButtonProps
	| Record<string, unknown>;

export interface WidgetBlock {
	id: string;
	type: BlockType;
	props: BlockProps;
	children?: WidgetBlock[];
}

/** Fields are blocks; stored inside a page. */
export type WidgetBlockSchema = WidgetBlock[];

/** A page in a multi-step widget: name, optional description, and fields (blocks). */
export interface WidgetPage {
	id: string;
	name: string;
	description?: string;
	fields: WidgetBlock[];
}

/** Action config for submit pipeline: create lead, notify, success behavior */
export interface WidgetVersionActions {
	createLead?: {
		enabled: boolean;
		tags?: string[];
	};
	notify?: {
		enabled: boolean;
	};
	success?: {
		message: string;
		redirectUrl?: string;
	};
}

import { useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { EmailTemplateBlock, EmailTemplatePlaceholder, EmailTypography, EmailBorder } from "@/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Braces, Trash2, Table } from "lucide-react";
import { parseNumber } from "@/lib/field-formatting";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EmailBlockPropertiesProps = {
  block?: EmailTemplateBlock;
  onChange: (updatedBlock: EmailTemplateBlock) => void;
  onDelete: (blockId: string) => void;
  onAddNestedBlock?: (parentBlockId: string, blockType: EmailTemplateBlock["type"], columnId?: string) => void;
	onOpenImagePicker?: (blockId: string) => void;
	placeholders: EmailTemplatePlaceholder[];
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

// Helper function to get default typography
const getDefaultTypography = () => ({
  fontSize: 16,
  fontWeight: "normal" as const,
  lineHeight: 1.5,
  letterSpacing: 0,
  color: "",
  fontStyle: "normal" as const,
  textDecoration: "none" as const,
});

// Helper function to get default spacing
const getDefaultSpacing = () => ({
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
});

// Helper function to get default border
const getDefaultBorder = () => ({
  borderWidth: 0,
  borderColor: "#e5e7eb",
  borderStyle: "solid" as const,
  borderRadius: 0,
});

const insertTokenAtCursor = (
	field: HTMLInputElement | HTMLTextAreaElement | null,
	currentValue: string,
	onChange: (value: string) => void,
	placeholderKey: string,
) => {
	if (!field) return;
	const token = `{{${placeholderKey}}}`;
	const selectionStart = field.selectionStart ?? currentValue.length;
	const selectionEnd = field.selectionEnd ?? currentValue.length;
	const nextValue =
		currentValue.slice(0, selectionStart) + token + currentValue.slice(selectionEnd);
	onChange(nextValue);
	requestAnimationFrame(() => {
		field.focus();
		const cursorPosition = selectionStart + token.length;
		field.selectionStart = cursorPosition;
		field.selectionEnd = cursorPosition;
	});
};

type PlaceholderInsertButtonProps = {
	placeholders: EmailTemplatePlaceholder[];
	onInsert: (key: string) => void;
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

const PlaceholderInsertButton = ({
	placeholders,
	onInsert,
	onAddPlaceholder,
}: PlaceholderInsertButtonProps) => {
	const handleInsert = (key: string) => {
		onInsert(key);
	};

	// Memoize menu items to ensure they update when placeholders change
	const menuItems = useMemo(() => {
		if (placeholders.length === 0) {
			return (
				<DropdownMenuItem disabled>
					No placeholders yet
				</DropdownMenuItem>
			);
		}
		return placeholders.map((placeholder) => (
			<DropdownMenuItem
				key={placeholder.id}
				onSelect={(event) => {
					event.preventDefault();
					handleInsert(placeholder.key);
				}}
			>
				{placeholder.key}
			</DropdownMenuItem>
		));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [placeholders]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" title="Insert placeholder">
					<Braces className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{menuItems}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onSelect={(event) => {
						event.preventDefault();
						const created = onAddPlaceholder();
						if (created) {
							handleInsert(created.key);
						}
					}}
				>
					+ Create placeholder
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

type PlaceholderTextareaFieldProps = {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	rows?: number;
	placeholders: EmailTemplatePlaceholder[];
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

const PlaceholderTextareaField = ({
	label,
	value,
	onChange,
	rows = 3,
	placeholders,
	invalidPlaceholders,
	onAddPlaceholder,
}: PlaceholderTextareaFieldProps) => {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const handleInsert = (key: string) => {
		insertTokenAtCursor(textareaRef.current, value, onChange, key);
	};
	return (
		<div className="space-y-2">
			{invalidPlaceholders && invalidPlaceholders.length > 0 && (
				<Alert variant="destructive" className="text-xs">
					<AlertCircle className="h-3.5 w-3.5" />
					<AlertTitle className="text-xs font-semibold">Invalid placeholder patterns detected</AlertTitle>
					<AlertDescription className="text-xs">
						<p className="mb-1.5">The template contains empty placeholder patterns like <code className="rounded bg-background px-1 py-0.5 text-[10px]">{"{{}}"}</code> that must be fixed before saving.</p>
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-xs"
							onClick={() => {
								const created = onAddPlaceholder();
								if (created) {
									handleInsert(created.key);
								}
							}}
						>
							<Plus className="h-3 w-3 mr-1" />
							Add placeholder key
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<PlaceholderInsertButton
					placeholders={placeholders}
					onAddPlaceholder={onAddPlaceholder}
					onInsert={handleInsert}
				/>
			</div>
			<Textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={rows}
			/>
		</div>
	);
};

type PlaceholderInputFieldProps = {
	label: ReactNode;
	value: string;
	onChange: (value: string) => void;
	type?: string;
	placeholders: EmailTemplatePlaceholder[];
	invalidPlaceholders?: string[];
	onAddPlaceholder: () => EmailTemplatePlaceholder | null;
};

const PlaceholderInputField = ({
	label,
	value,
	onChange,
	type = "text",
	placeholders,
	invalidPlaceholders,
	onAddPlaceholder,
}: PlaceholderInputFieldProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const handleInsert = (key: string) => {
		insertTokenAtCursor(inputRef.current, value, onChange, key);
	};
	return (
		<div className="space-y-2">
			{invalidPlaceholders && invalidPlaceholders.length > 0 && (
				<Alert variant="destructive" className="text-xs">
					<AlertCircle className="h-3.5 w-3.5" />
					<AlertTitle className="text-xs font-semibold">Invalid placeholder patterns detected</AlertTitle>
					<AlertDescription className="text-xs">
						<p className="mb-1.5">The template contains empty placeholder patterns like <code className="rounded bg-background px-1 py-0.5 text-[10px]">{"{{}}"}</code> that must be fixed before saving.</p>
						<Button
							variant="outline"
							size="sm"
							className="h-7 text-xs"
							onClick={() => {
								const created = onAddPlaceholder();
								if (created) {
									handleInsert(created.key);
								}
							}}
						>
							<Plus className="h-3 w-3 mr-1" />
							Add placeholder key
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<PlaceholderInsertButton
					placeholders={placeholders}
					onAddPlaceholder={onAddPlaceholder}
					onInsert={handleInsert}
				/>
			</div>
			<Input
				ref={inputRef}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
};

export function EmailBlockProperties({ block, onChange, onDelete, onAddNestedBlock, onOpenImagePicker, placeholders, invalidPlaceholders, onAddPlaceholder }: EmailBlockPropertiesProps) {
  const { t } = useTranslation();

  if (!block) {
    return (
      <Card className="h-full border-none bg-card/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t("emailDesigner.properties.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("emailDesigner.properties.empty")}
        </CardContent>
      </Card>
    );
  }

  const renderTypographyControls = () => {
    // Elements that support typography
    const supportsTypography = ["subject", "preheader", "text", "button", "navigation", "footerText", "unsubscribe"].includes(block.type);
    if (!supportsTypography) return null;
    
    // Type guard to ensure typography exists
    const blockWithTypography = block as Extract<EmailTemplateBlock, { typography?: EmailTypography }>;
    const typography = (blockWithTypography.typography || getDefaultTypography());
    
    if (!typography) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.typography")}
          </Label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontSize")}</Label>
                <Input
                  type="number"
                  min={10}
                  max={72}
                  value={typography.fontSize}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontSize: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontWeight")}</Label>
                <Select
                  value={typography.fontWeight}
                  onValueChange={(value: "normal" | "400" | "500" | "600" | "700" | "bold") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontWeight: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="400">400</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="600">600</SelectItem>
                    <SelectItem value="700">700</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.lineHeight")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={3}
                  step={0.1}
                  value={typography.lineHeight}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, lineHeight: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.letterSpacing")}</Label>
                <Input
                  type="number"
                  min={-2}
                  max={5}
                  step={0.1}
                  value={typography.letterSpacing}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value);
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, letterSpacing: parsed } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.textColor")}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={typography.color || "#000000"}
                  onChange={(e) => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, color: e.target.value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8 w-16"
                />
                <Input
                  value={typography.color || ""}
                  onChange={(e) => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, color: e.target.value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                  placeholder="#000000"
                  className="h-8 flex-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.fontStyle")}</Label>
                <Select
                  value={typography.fontStyle}
                  onValueChange={(value: "normal" | "italic") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, fontStyle: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.textDecoration")}</Label>
                <Select
                  value={typography.textDecoration}
                  onValueChange={(value: "none" | "underline" | "line-through") => {
                    const updated = (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "button")
                      ? { ...block, typography: { ...typography, textDecoration: value } }
                      : block;
                    onChange(updated as EmailTemplateBlock);
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="line-through">Line Through</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpacingControls = () => {
    // Elements that support spacing
    const supportsSpacing = ["subject", "preheader", "text", "button", "divider", "image", "logo", "navigation", "footerText", "socialLinks", "unsubscribe", "spacer"].includes(block.type);
    const spacing = supportsSpacing
      ? (block.spacing || getDefaultSpacing())
      : null;
    
    if (!spacing) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.spacing")}
          </Label>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-2 block">{t("emailDesigner.properties.padding")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Top</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingTop}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingTop: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Right</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingRight}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingRight: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bottom</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingBottom}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingBottom: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Left</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.paddingLeft}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, paddingLeft: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">{t("emailDesigner.properties.margin")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Top</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginTop}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginTop: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Right</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginRight}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginRight: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bottom</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginBottom}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginBottom: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Left</Label>
                  <Input
                    type="number"
                    min={0}
                    max={64}
                    value={spacing.marginLeft}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      const updated = { ...block, spacing: { ...spacing, marginLeft: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBorderControls = () => {
    // Elements that support borders
    const supportsBorder = ["subject", "preheader", "text", "button", "image", "logo", "navigation", "footerText", "socialLinks", "divider"].includes(block.type);
    if (!supportsBorder) return null;
    
    // Type guard to ensure border exists
    const blockWithBorder = block as Extract<EmailTemplateBlock, { border?: EmailBorder }>;
    const border = (blockWithBorder.border || getDefaultBorder());
    
    if (!border) return null;

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">
            {t("emailDesigner.properties.border")}
          </Label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.borderWidth")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={border.borderWidth}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value, false);
                    const updated = { ...block, border: { ...border, borderWidth: parsed } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("emailDesigner.properties.borderRadius")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={border.borderRadius}
                  onChange={(e) => {
                    const parsed = parseNumber(e.target.value, false);
                    if (parsed !== undefined) {
                      const updated = { ...block, border: { ...border, borderRadius: parsed } };
                      onChange(updated as EmailTemplateBlock);
                    }
                  }}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.borderColor")}</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={border.borderColor}
                  onChange={(e) => {
                    const updated = { ...block, border: { ...border, borderColor: e.target.value } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  className="h-8 w-16"
                />
                <Input
                  value={border.borderColor}
                  onChange={(e) => {
                    const updated = { ...block, border: { ...border, borderColor: e.target.value } };
                    onChange(updated as EmailTemplateBlock);
                  }}
                  placeholder="#e5e7eb"
                  className="h-8 flex-1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("emailDesigner.properties.borderStyle")}</Label>
              <Select
                value={border.borderStyle}
                onValueChange={(value: "solid" | "dashed" | "dotted") => {
                  const updated = { ...block, border: { ...border, borderStyle: value } };
                  onChange(updated as EmailTemplateBlock);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">{t("emailDesigner.properties.solid")}</SelectItem>
                  <SelectItem value="dashed">{t("emailDesigner.properties.dashed")}</SelectItem>
                  <SelectItem value="dotted">{t("emailDesigner.properties.dotted")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBackgroundColorControls = () => {
    // Elements that support background color
    const supportsBackground = ["subject", "preheader", "text", "button", "image", "logo", "navigation", "footerText", "socialLinks", "unsubscribe", "spacer", "divider"].includes(block.type);
    
    if (!supportsBackground) return null;

    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={(block as Extract<EmailTemplateBlock, { backgroundColor?: string }>).backgroundColor || "#ffffff"}
            onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
            className="h-8 w-16"
          />
          <Input
            value={(block as Extract<EmailTemplateBlock, { backgroundColor?: string }>).backgroundColor || ""}
            onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
            placeholder="transparent"
            className="h-8 flex-1"
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full border-none bg-card/80 shadow-none flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 shrink-0">
        <CardTitle className="text-lg font-semibold">
          {t(`emailDesigner.blocks.${block.type}` as const)}
        </CardTitle>
        <Button variant="destructive" size="sm" onClick={() => onDelete(block.id)}>
          {t("emailDesigner.properties.delete")}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Content/Base Properties */}
            {(block.type === "subject" || block.type === "preheader") && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={block.content}
									onChange={(value) => onChange({ ...block, content: value })}
									rows={3}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}
            {block.type === "text" && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={block.content}
									onChange={(value) => onChange({ ...block, content: value })}
									rows={4}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={block.align}
                    onValueChange={(value: "left" | "center" | "right" | "justify") =>
                      onChange({ ...block, align: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="emphasizeToggle">{t("emailDesigner.properties.emphasize")}</Label>
                  <Switch
                    id="emphasizeToggle"
                    checked={block.emphasize}
                    onCheckedChange={(checked) => onChange({ ...block, emphasize: checked })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "button" && (
              <>
                <PlaceholderInputField
									label={t("emailDesigner.properties.label")}
									value={block.label}
									onChange={(value) => onChange({ ...block, label: value })}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <PlaceholderInputField
									label={t("emailDesigner.properties.url")}
									value={block.url}
									onChange={(value) => onChange({ ...block, url: value })}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.variant")}</Label>
                    <Select
                      value={block.variant}
                      onValueChange={(value: "primary" | "secondary" | "link") =>
                        onChange({ ...block, variant: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">{t("emailDesigner.properties.primary")}</SelectItem>
                        <SelectItem value="secondary">{t("emailDesigner.properties.secondary")}</SelectItem>
                        <SelectItem value="link">{t("emailDesigner.properties.link")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.buttonWidth")}</Label>
                    <Select
                      value={block.buttonWidth || "auto"}
                      onValueChange={(value: "auto" | "full") =>
                        onChange({ ...block, buttonWidth: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="full">Full Width</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.buttonHeight")}</Label>
                    <Input
                      type="number"
                      min={32}
                      max={64}
                      value={block.buttonHeight || 44}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        if (parsed !== undefined) {
                          onChange({ ...block, buttonHeight: parsed });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.backgroundColor || "#2563eb"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value })}
                      placeholder="#2563eb"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "divider" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.style")}</Label>
                    <Select
                      value={block.style}
                      onValueChange={(value: "solid" | "dashed" | "dotted") => onChange({ ...block, style: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">{t("emailDesigner.properties.solid")}</SelectItem>
                        <SelectItem value="dashed">{t("emailDesigner.properties.dashed")}</SelectItem>
                        <SelectItem value="dotted">{t("emailDesigner.properties.dotted")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align || "center"}
                      onValueChange={(value: "left" | "center" | "right") => onChange({ ...block, align: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.dividerWidth")} ({block.dividerWidth || 100}%)</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[block.dividerWidth || 100]}
                      onValueChange={([value]) => onChange({ ...block, dividerWidth: value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.lineWidth")} ({block.width || 1}px)</Label>
                    <Slider
                      min={1}
                      max={8}
                      step={1}
                      value={[block.width || 1]}
                      onValueChange={([value]) => onChange({ ...block, width: value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.color")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={block.color || "#e5e7eb"}
                      onChange={(e) => onChange({ ...block, color: e.target.value })}
                      className="h-8 w-16"
                    />
                    <Input
                      value={block.color || ""}
                      onChange={(e) => onChange({ ...block, color: e.target.value })}
                      placeholder="#e5e7eb"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "spacer" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.height")}: {block.height}px</Label>
                  <Slider
                    min={8}
                    max={128}
                    step={1}
                    value={[block.height]}
                    onValueChange={([value]) => onChange({ ...block, height: value })}
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
              </>
            )}

            {block.type === "image" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.imageUrl")}</Label>
						<div className="relative">
							<Input
								type="url"
								value={block.src}
								onChange={(e) => onChange({ ...block, src: e.target.value })}
								className={onOpenImagePicker ? "pr-24" : undefined}
								placeholder="https://"
							/>
							{onOpenImagePicker && (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onClick={() => onOpenImagePicker(block.id)}
									className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
								>
									{t("emailDesigner.properties.chooseImage")}
								</Button>
							)}
						</div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.altText")}</Label>
                  <Input
                    value={block.alt || ""}
                    onChange={(e) => onChange({ ...block, alt: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.width")}</Label>
                    <Input
                      type="number"
                      min={24}
                      max={600}
                      value={block.width}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        if (parsed !== undefined) {
                          onChange({ ...block, width: parsed });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={block.align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.aspectRatio")}</Label>
                  <Select
                    value={block.aspectRatio || "auto"}
                    onValueChange={(value: "auto" | "1:1" | "16:9" | "4:3" | "3:2" | "21:9" | "custom") =>
                      onChange({ ...block, aspectRatio: value, ...(value !== "custom" ? { aspectRatioCustom: undefined } : {}) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("emailDesigner.properties.aspectRatioAuto")}</SelectItem>
                      <SelectItem value="1:1">{t("emailDesigner.properties.aspectRatio1_1")}</SelectItem>
                      <SelectItem value="16:9">{t("emailDesigner.properties.aspectRatio16_9")}</SelectItem>
                      <SelectItem value="4:3">{t("emailDesigner.properties.aspectRatio4_3")}</SelectItem>
                      <SelectItem value="3:2">{t("emailDesigner.properties.aspectRatio3_2")}</SelectItem>
                      <SelectItem value="21:9">{t("emailDesigner.properties.aspectRatio21_9")}</SelectItem>
                      <SelectItem value="custom">{t("emailDesigner.properties.aspectRatioCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {block.aspectRatio === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.aspectRatioCustomValue")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={block.aspectRatioCustom || 1}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value);
                        onChange({ ...block, aspectRatioCustom: parsed });
                      }}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("emailDesigner.properties.aspectRatioCustomHint")}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.borderRadius")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={block.borderRadius || 0}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      if (parsed !== undefined) {
                        onChange({ ...block, borderRadius: parsed });
                      }
                    }}
                  />
                </div>
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "logo" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.imageUrl")}</Label>
                  <div className="relative">
                    <Input
                      type="url"
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).src}
                      onChange={(e) => onChange({ ...block, src: e.target.value } as EmailTemplateBlock)}
                      className={onOpenImagePicker ? "pr-24" : undefined}
                      placeholder="https://"
                    />
                    {onOpenImagePicker && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenImagePicker(block.id)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                      >
                        {t("emailDesigner.properties.chooseImage")}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.altText")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).alt || ""}
                    onChange={(e) => onChange({ ...block, alt: e.target.value } as EmailTemplateBlock)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.width")}</Label>
                    <Input
                      type="number"
                      min={24}
                      max={300}
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).width}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        onChange({ ...block, width: parsed } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.aspectRatio")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatio || "auto"}
                    onValueChange={(value: "auto" | "1:1" | "16:9" | "4:3" | "3:2" | "21:9" | "custom") =>
                      onChange({ ...block, aspectRatio: value, ...(value !== "custom" ? { aspectRatioCustom: undefined } : {}) } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("emailDesigner.properties.aspectRatioAuto")}</SelectItem>
                      <SelectItem value="1:1">{t("emailDesigner.properties.aspectRatio1_1")}</SelectItem>
                      <SelectItem value="16:9">{t("emailDesigner.properties.aspectRatio16_9")}</SelectItem>
                      <SelectItem value="4:3">{t("emailDesigner.properties.aspectRatio4_3")}</SelectItem>
                      <SelectItem value="3:2">{t("emailDesigner.properties.aspectRatio3_2")}</SelectItem>
                      <SelectItem value="21:9">{t("emailDesigner.properties.aspectRatio21_9")}</SelectItem>
                      <SelectItem value="custom">{t("emailDesigner.properties.aspectRatioCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatio === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.aspectRatioCustomValue")}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={10}
                      value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).aspectRatioCustom || 1}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value);
                        onChange({ ...block, aspectRatioCustom: parsed } as EmailTemplateBlock);
                      }}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("emailDesigner.properties.aspectRatioCustomHint")}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.link")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).link || ""}
                    onChange={(e) => onChange({ ...block, link: e.target.value } as EmailTemplateBlock)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.borderRadius")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={(block as Extract<EmailTemplateBlock, { type: "logo" }>).borderRadius || 0}
                    onChange={(e) => {
                      const parsed = parseNumber(e.target.value, false);
                      if (parsed !== undefined) {
                        onChange({ ...block, borderRadius: parsed } as EmailTemplateBlock);
                      }
                    }}
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "navigation" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.navigationLinks")}</Label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("emailDesigner.properties.navigationLinksHint")}
                  </div>
                  <div className="space-y-2">
                    {((block as Extract<EmailTemplateBlock, { type: "navigation" }>).links || []).map((link: { label: string; url: string }, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          placeholder={t("emailDesigner.properties.linkLabel")}
                          value={link.label}
                          onChange={(e) => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = [...(navBlock.links || [])];
                            updatedLinks[idx] = { ...link, label: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder={t("emailDesigner.properties.url")}
                          value={link.url}
                          onChange={(e) => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = [...(navBlock.links || [])];
                            updatedLinks[idx] = { ...link, url: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                            const updatedLinks = (navBlock.links || []).filter((_: { label: string; url: string }, i: number) => i !== idx);
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
                        onChange({ ...block, links: [...(navBlock.links || []), { label: "", url: "" }] } as EmailTemplateBlock);
                      }}
                    >
                      + {t("emailDesigner.properties.addLink")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "navigation" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "footerText" && (
              <>
                <PlaceholderTextareaField
									label={t("emailDesigner.properties.textContent")}
									value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).content}
									onChange={(value) =>
										onChange({ ...block, content: value } as EmailTemplateBlock)
									}
									rows={4}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("emailDesigner.properties.backgroundColor")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).backgroundColor || "#ffffff"}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
                      className="h-8 w-16"
                    />
                    <Input
                      value={(block as Extract<EmailTemplateBlock, { type: "footerText" }>).backgroundColor || ""}
                      onChange={(e) => onChange({ ...block, backgroundColor: e.target.value } as EmailTemplateBlock)}
                      placeholder="transparent"
                      className="h-8 flex-1"
                    />
                  </div>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "socialLinks" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.socialLinks")}</Label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {t("emailDesigner.properties.socialLinksHint")}
                  </div>
                  <div className="space-y-2">
                    {((block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).links || []).map((link, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Select
                          value={link.platform}
                          onValueChange={(value: "facebook" | "twitter" | "instagram" | "linkedin" | "youtube" | "custom") => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = [...(socialBlock.links || [])];
                            updatedLinks[idx] = { ...link, platform: value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder={t("emailDesigner.properties.url")}
                          value={link.url}
                          onChange={(e) => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = [...(socialBlock.links || [])];
                            updatedLinks[idx] = { ...link, url: e.target.value };
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                            const updatedLinks = (socialBlock.links || []).filter((_: { platform: string; url: string; icon?: string }, i: number) => i !== idx);
                            onChange({ ...block, links: updatedLinks } as EmailTemplateBlock);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
                        onChange({ ...block, links: [...(socialBlock.links || []), { platform: "custom", url: "" }] } as EmailTemplateBlock);
                      }}
                    >
                      + {t("emailDesigner.properties.addLink")}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.iconSize")}</Label>
                    <Input
                      type="number"
                      min={16}
                      max={48}
                      value={(block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).iconSize || 24}
                      onChange={(e) => {
                        const parsed = parseNumber(e.target.value, false);
                        onChange({ ...block, iconSize: parsed } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "socialLinks" }>).align}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "unsubscribe" && (
              <>
                <PlaceholderInputField
									label={t("emailDesigner.properties.text")}
									value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).text}
									onChange={(value) =>
										onChange({ ...block, text: value } as EmailTemplateBlock)
									}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <PlaceholderInputField
									label={t("emailDesigner.properties.url")}
									value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).url}
									onChange={(value) =>
										onChange({ ...block, url: value } as EmailTemplateBlock)
									}
									placeholders={placeholders}
									invalidPlaceholders={invalidPlaceholders}
									onAddPlaceholder={onAddPlaceholder}
								/>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>).align}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                {renderTypographyControls()}
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "columns" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.columnCount")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "columns" }>).columnCount || "2"}
                    onValueChange={(value: "2" | "3" | "4") => {
                      const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
                      const newCount = parseInt(value);
                      const currentColumns = colsBlock.columns || [];
                      const newColumns = Array.from({ length: newCount }, (_, i) => {
                        if (i < currentColumns.length) {
                          return { ...currentColumns[i], width: 100 / newCount };
                        }
                        return {
                          id: crypto.randomUUID(),
                          width: 100 / newCount,
                          blocks: [],
                        };
                      });
                      onChange({
                        ...block,
                        columnCount: value,
                        columns: newColumns.slice(0, newCount),
                      } as EmailTemplateBlock);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">{t("emailDesigner.properties.twoColumns")}</SelectItem>
                      <SelectItem value="3">{t("emailDesigner.properties.threeColumns")}</SelectItem>
                      <SelectItem value="4">{t("emailDesigner.properties.fourColumns")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.gap")}: {(block as Extract<EmailTemplateBlock, { type: "columns" }>).gap || 16}px</Label>
                  <Slider
                    min={0}
                    max={48}
                    step={4}
                    value={[(block as Extract<EmailTemplateBlock, { type: "columns" }>).gap || 16]}
                    onValueChange={([value]) => onChange({ ...block, gap: value } as EmailTemplateBlock)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.alignment")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "columns" }>).align || "left"}
                    onValueChange={(value: "left" | "center" | "right") =>
                      onChange({ ...block, align: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                      <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                      <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("emailDesigner.properties.stackOnMobile")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "columns" }>).stackOnMobile ?? true}
                      onCheckedChange={(checked) =>
                        onChange({ ...block, stackOnMobile: checked } as EmailTemplateBlock)
                      }
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.columns")}</Label>
                  {(block as Extract<EmailTemplateBlock, { type: "columns" }>).columns.map((column, colIdx) => (
                    <div key={column.id} className="p-3 border rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{t("emailDesigner.properties.column")} {colIdx + 1}</Label>
                        <span className="text-xs text-muted-foreground">{column.blocks?.length || 0} {t("emailDesigner.properties.blocks")}</span>
                      </div>
                      {onAddNestedBlock && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => onAddNestedBlock(block.id, "text", column.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {t("emailDesigner.properties.addText")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs h-7"
                            onClick={() => onAddNestedBlock(block.id, "image", column.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {t("emailDesigner.properties.addImage")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "container" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.maxWidth")}</Label>
                    <Select
                      value={String((block as Extract<EmailTemplateBlock, { type: "container" }>).maxWidth || 600)}
                      onValueChange={(value) =>
                        onChange({ ...block, maxWidth: parseInt(value) as 520 | 600 | 680 | 800 } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="520">520px</SelectItem>
                        <SelectItem value="600">600px</SelectItem>
                        <SelectItem value="680">680px</SelectItem>
                        <SelectItem value="800">800px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("emailDesigner.properties.alignment")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "container" }>).align || "center"}
                      onValueChange={(value: "left" | "center" | "right") =>
                        onChange({ ...block, align: value } as EmailTemplateBlock)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                        <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                        <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.padding")}</Label>
                  <Select
                    value={(block as Extract<EmailTemplateBlock, { type: "container" }>).padding || "md"}
                    onValueChange={(value: "none" | "xs" | "sm" | "md" | "lg") =>
                      onChange({ ...block, padding: value } as EmailTemplateBlock)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("emailDesigner.properties.paddingNone")}</SelectItem>
                      <SelectItem value="xs">{t("emailDesigner.properties.paddingXS")}</SelectItem>
                      <SelectItem value="sm">{t("emailDesigner.properties.paddingSM")}</SelectItem>
                      <SelectItem value="md">{t("emailDesigner.properties.paddingMD")}</SelectItem>
                      <SelectItem value="lg">{t("emailDesigner.properties.paddingLG")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.nestedBlocks")}</Label>
                  <div className="p-3 border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {(block as Extract<EmailTemplateBlock, { type: "container" }>).blocks?.length || 0} {t("emailDesigner.properties.blocks")}
                      </span>
                    </div>
                    {onAddNestedBlock && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => onAddNestedBlock(block.id, "text")}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("emailDesigner.properties.addText")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => onAddNestedBlock(block.id, "image")}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("emailDesigner.properties.addImage")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => onAddNestedBlock(block.id, "button")}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("emailDesigner.properties.addButton")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => onAddNestedBlock(block.id, "divider")}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("emailDesigner.properties.addDivider")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}

            {block.type === "table" && (
              <>
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.dataSource")}</Label>
                  <PlaceholderInputField
                    label=""
                    value={(block as Extract<EmailTemplateBlock, { type: "table" }>).dataSource || ""}
                    onChange={(value) =>
                      onChange({ ...block, dataSource: value } as EmailTemplateBlock)
                    }
                    placeholders={placeholders}
                    invalidPlaceholders={invalidPlaceholders}
                    onAddPlaceholder={onAddPlaceholder}
                    placeholder={t("emailDesigner.properties.dataSourcePlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("emailDesigner.properties.dataSourceHint")}
                  </p>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t("emailDesigner.properties.columns")}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        const newColumn = {
                          id: crypto.randomUUID(),
                          header: "New Column",
                          binding: "",
                          type: "text" as const,
                          align: "left" as const,
                          priority: "medium" as const,
                          format: "none" as const,
                        };
                        onChange({
                          ...block,
                          columns: [...(tableBlock.columns || []), newColumn],
                        } as EmailTemplateBlock);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t("emailDesigner.properties.addColumn")}
                    </Button>
                  </div>
                  {(block as Extract<EmailTemplateBlock, { type: "table" }>).columns?.map((column, colIdx) => (
                    <div key={column.id} className="p-3 border rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">
                          {t("emailDesigner.properties.column")} {colIdx + 1}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                            onChange({
                              ...block,
                              columns: tableBlock.columns?.filter((c) => c.id !== column.id) || [],
                            } as EmailTemplateBlock);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">{t("emailDesigner.properties.header")}</Label>
                          <Input
                            value={column.header}
                            onChange={(e) => {
                              const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                              onChange({
                                ...block,
                                columns: tableBlock.columns?.map((c) =>
                                  c.id === column.id ? { ...c, header: e.target.value } : c
                                ) || [],
                              } as EmailTemplateBlock);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("emailDesigner.properties.binding")}</Label>
                          <Input
                            value={column.binding || ""}
                            onChange={(e) => {
                              const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                              onChange({
                                ...block,
                                columns: tableBlock.columns?.map((c) =>
                                  c.id === column.id ? { ...c, binding: e.target.value } : c
                                ) || [],
                              } as EmailTemplateBlock);
                            }}
                            placeholder={t("emailDesigner.properties.bindingPlaceholder")}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{t("emailDesigner.properties.type")}</Label>
                            <Select
                              value={column.type}
                              onValueChange={(value: "text" | "number" | "currency" | "badge") => {
                                const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                                onChange({
                                  ...block,
                                  columns: tableBlock.columns?.map((c) =>
                                    c.id === column.id ? { ...c, type: value } : c
                                  ) || [],
                                } as EmailTemplateBlock);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">{t("emailDesigner.properties.columnTypeText")}</SelectItem>
                                <SelectItem value="number">{t("emailDesigner.properties.columnTypeNumber")}</SelectItem>
                                <SelectItem value="currency">{t("emailDesigner.properties.columnTypeCurrency")}</SelectItem>
                                <SelectItem value="badge">{t("emailDesigner.properties.columnTypeBadge")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t("emailDesigner.properties.alignment")}</Label>
                            <Select
                              value={column.align}
                              onValueChange={(value: "left" | "center" | "right") => {
                                const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                                onChange({
                                  ...block,
                                  columns: tableBlock.columns?.map((c) =>
                                    c.id === column.id ? { ...c, align: value } : c
                                  ) || [],
                                } as EmailTemplateBlock);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">{t("emailDesigner.properties.alignLeft")}</SelectItem>
                                <SelectItem value="center">{t("emailDesigner.properties.alignCenter")}</SelectItem>
                                <SelectItem value="right">{t("emailDesigner.properties.alignRight")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {column.type === "currency" && (
                          <div>
                            <Label className="text-xs">{t("emailDesigner.properties.currency")}</Label>
                            <Input
                              value={column.currency || "USD"}
                              onChange={(e) => {
                                const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                                onChange({
                                  ...block,
                                  columns: tableBlock.columns?.map((c) =>
                                    c.id === column.id ? { ...c, currency: e.target.value.toUpperCase().slice(0, 3) } : c
                                  ) || [],
                                } as EmailTemplateBlock);
                              }}
                              placeholder={t("emailDesigner.properties.currencyPlaceholder")}
                              className="h-8 text-xs"
                              maxLength={3}
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">{t("emailDesigner.properties.priority")}</Label>
                          <Select
                            value={column.priority}
                            onValueChange={(value: "high" | "medium" | "low") => {
                              const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                              onChange({
                                ...block,
                                columns: tableBlock.columns?.map((c) =>
                                  c.id === column.id ? { ...c, priority: value } : c
                                ) || [],
                              } as EmailTemplateBlock);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">{t("emailDesigner.properties.high")}</SelectItem>
                              <SelectItem value="medium">{t("emailDesigner.properties.medium")}</SelectItem>
                              <SelectItem value="low">{t("emailDesigner.properties.low")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="p-3 border border-dashed rounded-md text-center text-sm text-muted-foreground">
                      {t("emailDesigner.properties.noColumns")}
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.styling")}</Label>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("emailDesigner.properties.borderStyle")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "table" }>).style?.borderStyle || "light"}
                      onValueChange={(value: "none" | "light" | "strong") => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          style: {
                            ...tableBlock.style,
                            borderStyle: value,
                          },
                        } as EmailTemplateBlock);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("emailDesigner.properties.none")}</SelectItem>
                        <SelectItem value="light">{t("emailDesigner.properties.light")}</SelectItem>
                        <SelectItem value="strong">{t("emailDesigner.properties.strong")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("emailDesigner.properties.paddingDensity")}</Label>
                    <Select
                      value={(block as Extract<EmailTemplateBlock, { type: "table" }>).style?.paddingDensity || "comfortable"}
                      onValueChange={(value: "compact" | "comfortable" | "spacious") => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          style: {
                            ...tableBlock.style,
                            paddingDensity: value,
                          },
                        } as EmailTemplateBlock);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">{t("emailDesigner.properties.compact")}</SelectItem>
                        <SelectItem value="comfortable">{t("emailDesigner.properties.comfortable")}</SelectItem>
                        <SelectItem value="spacious">{t("emailDesigner.properties.spacious")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t("emailDesigner.properties.alternatingRows")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "table" }>).style?.alternatingRows || false}
                      onCheckedChange={(checked) => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          style: {
                            ...tableBlock.style,
                            alternatingRows: checked,
                          },
                        } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t("emailDesigner.properties.showBorders")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "table" }>).style?.showBorders !== false}
                      onCheckedChange={(checked) => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          style: {
                            ...tableBlock.style,
                            showBorders: checked,
                          },
                        } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("emailDesigner.properties.responsive")}</Label>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t("emailDesigner.properties.stackOnMobile")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "table" }>).responsive?.stackOnMobile !== false}
                      onCheckedChange={(checked) => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          responsive: {
                            ...tableBlock.responsive,
                            stackOnMobile: checked,
                          },
                        } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t("emailDesigner.properties.hideLowPriorityColumns")}</Label>
                    <Switch
                      checked={(block as Extract<EmailTemplateBlock, { type: "table" }>).responsive?.hideLowPriorityColumns !== false}
                      onCheckedChange={(checked) => {
                        const tableBlock = block as Extract<EmailTemplateBlock, { type: "table" }>;
                        onChange({
                          ...block,
                          responsive: {
                            ...tableBlock.responsive,
                            hideLowPriorityColumns: checked,
                          },
                        } as EmailTemplateBlock);
                      }}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>{t("emailDesigner.properties.emptyMessage")}</Label>
                  <Input
                    value={(block as Extract<EmailTemplateBlock, { type: "table" }>).emptyMessage || t("emailDesigner.properties.emptyMessageDefault")}
                    onChange={(e) =>
                      onChange({ ...block, emptyMessage: e.target.value } as EmailTemplateBlock)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <Separator />
                {renderBackgroundColorControls()}
                <Separator />
                {renderSpacingControls()}
                <Separator />
                {renderBorderControls()}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

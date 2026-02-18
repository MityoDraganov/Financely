import { EmailTemplateDesignTokens, EmailTemplateVersion } from "@/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { EmailTemplateVersionHistory } from "./email-template-version-history";

type EmailTemplateSettingsProps = {
	name: string;
	designTokens: EmailTemplateDesignTokens;
	versions?: EmailTemplateVersion[];
	currentVersion?: number | null;
	onSaveVersion?: () => Promise<void>;
	onRestoreVersion?: (version: number) => Promise<void>;
	isSavingVersion?: boolean;
	isRestoringVersion?: boolean;
	currentUserId?: string;
	onChange: (updates: Partial<{
		name: string;
		designTokens: EmailTemplateDesignTokens;
	}>) => void;
};

export function EmailTemplateSettings({
	name,
	designTokens,
	versions = [],
	currentVersion = null,
	onSaveVersion,
	onRestoreVersion,
	isSavingVersion = false,
	isRestoringVersion = false,
	currentUserId,
	onChange,
}: EmailTemplateSettingsProps) {
	const { t } = useTranslation();

	const updateDesignTokens = (updates: Partial<EmailTemplateDesignTokens>) => {
		onChange({
			designTokens: {
				...designTokens,
				...updates,
			},
		});
	};

	return (
		<div className="space-y-4 p-3">
			<Card className="border border-border/70 bg-background shadow-sm">
				<CardHeader className="pb-3">
					<CardTitle className="text-lg font-semibold">{t("emailDesigner.settings.title")}</CardTitle>
					<p className="text-xs text-muted-foreground">Global template styles applied across all blocks.</p>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="space-y-2">
						<Label>{t("emailDesigner.settings.name")}</Label>
						<Input
							value={name}
							className="bg-background"
							onChange={(e) => onChange({ name: e.target.value })}
						/>
					</div>

					<div className="text-sm text-muted-foreground p-3.5 bg-muted/45 border border-border/60 rounded-lg">
						<p className="font-medium text-foreground mb-1">
							{t("emailDesigner.settings.subject")} & {t("emailDesigner.settings.preheader")}
						</p>
						<p className="text-xs">Add Subject and Preheader blocks from the blocks list to edit them.</p>
					</div>

					<div className="space-y-3">
						<ColorTokenControl
							label={t("emailDesigner.settings.background")}
							value={designTokens.background}
							onChange={(value) => updateDesignTokens({ background: value })}
						/>
						<ColorTokenControl
							label={t("emailDesigner.settings.surface")}
							value={designTokens.surface}
							onChange={(value) => updateDesignTokens({ surface: value })}
						/>
						<ColorTokenControl
							label={t("emailDesigner.settings.primaryColor")}
							value={designTokens.primary}
							onChange={(value) => updateDesignTokens({ primary: value })}
						/>
						<ColorTokenControl
							label={t("emailDesigner.settings.textColor")}
							value={designTokens.text}
							onChange={(value) => updateDesignTokens({ text: value })}
						/>
					</div>

					<div className="space-y-2">
						<Label>{t("emailDesigner.settings.fontFamily")}</Label>
						<Input
							value={designTokens.fontFamily}
							className="bg-background"
							onChange={(e) => updateDesignTokens({ fontFamily: e.target.value })}
						/>
					</div>

					<div className="space-y-2">
						<Label>Corner radius</Label>
						<div className="flex items-center gap-2">
							<Input
								type="number"
								min={0}
								max={48}
								value={designTokens.borderRadius ?? 12}
								className="w-24 bg-background"
								onChange={(e) => {
									const next = Number(e.target.value);
									updateDesignTokens({ borderRadius: Number.isFinite(next) ? next : 0 });
								}}
							/>
							<span className="text-xs text-muted-foreground">px</span>
						</div>
					</div>

					<div
						className="rounded-lg border border-border/70 px-4 py-3 text-sm"
						style={{
							backgroundColor: designTokens.surface,
							color: designTokens.text,
							borderRadius: `${designTokens.borderRadius ?? 12}px`,
							fontFamily: designTokens.fontFamily,
						}}
					>
						<span
							className="inline-flex rounded-md px-2 py-1 text-xs font-semibold text-white mr-2"
							style={{ backgroundColor: designTokens.primary }}
						>
							Primary
						</span>
						Token preview
					</div>
				</CardContent>
			</Card>
			{onSaveVersion && onRestoreVersion && (
				<EmailTemplateVersionHistory
					versions={versions}
					currentVersion={currentVersion}
					onSaveVersion={onSaveVersion}
					onRestoreVersion={onRestoreVersion}
					isSavingVersion={isSavingVersion}
					isRestoringVersion={isRestoringVersion}
					currentUserId={currentUserId}
				/>
			)}
		</div>
	);
}

function ColorTokenControl({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<div className="flex items-center gap-2">
				<div className="relative">
					<Input
						type="color"
						value={value}
						className="h-9 w-11 p-1 cursor-pointer bg-background"
						onChange={(e) => onChange(e.target.value)}
					/>
				</div>
				<Input
					value={value}
					className="font-mono uppercase bg-background"
					onChange={(e) => onChange(e.target.value)}
				/>
			</div>
		</div>
	);
}

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, RotateCcw, Save } from "lucide-react";
import { EmailTemplateVersion } from "@/core";

type EmailTemplateVersionHistoryProps = {
	versions: EmailTemplateVersion[];
	currentVersion: number | null;
	onSaveVersion: () => Promise<void>;
	onRestoreVersion: (version: number) => Promise<void>;
	isSavingVersion?: boolean;
	isRestoringVersion?: boolean;
	currentUserId?: string;
};

export function EmailTemplateVersionHistory({
	versions,
	currentVersion,
	onSaveVersion,
	onRestoreVersion,
	isSavingVersion = false,
	isRestoringVersion = false,
	currentUserId,
}: EmailTemplateVersionHistoryProps) {
	const { t } = useTranslation();
	const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

	const sortedVersions = useMemo(() => {
		return [...versions].sort((a, b) => {
			if (b.version !== a.version) return b.version - a.version;
			const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
			const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
			return bTime - aTime;
		});
	}, [versions]);

	const formatDateTime = (value?: string) => {
		if (!value) return t("emailDesigner.versionHistory.unknownDate", "Unknown date");
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return t("emailDesigner.versionHistory.unknownDate", "Unknown date");
		return parsed.toLocaleString();
	};

	const handleRestore = async (version: number) => {
		setRestoringVersion(version);
		try {
			await onRestoreVersion(version);
		} finally {
			setRestoringVersion(null);
		}
	};

	return (
		<Card className="border border-border/70 bg-background shadow-sm">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between gap-2">
					<CardTitle className="text-base font-semibold flex items-center gap-2">
						<History className="h-4 w-4" />
						{t("emailDesigner.versionHistory.title", "Version history")}
					</CardTitle>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="gap-1.5"
						onClick={() => void onSaveVersion()}
						disabled={isSavingVersion}
					>
						{isSavingVersion ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Save className="h-3.5 w-3.5" />
						)}
						{t("emailDesigner.versionHistory.saveSnapshot", "Save snapshot")}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					{t("emailDesigner.versionHistory.subtitle", "View previous versions and restore when needed.")}
				</p>
			</CardHeader>
			<CardContent>
				{sortedVersions.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
						{t("emailDesigner.versionHistory.empty", "No saved versions yet.")}
					</div>
				) : (
					<ScrollArea className="max-h-64 pr-3">
						<div className="space-y-2">
							{sortedVersions.map((version) => {
								const isCurrent = currentVersion === version.version;
								const isRestoringThisVersion =
									isRestoringVersion && restoringVersion === version.version;
								const createdByCurrentUser =
									Boolean(currentUserId) && version.createdBy === currentUserId;
								return (
									<div
										key={version.id}
										className="rounded-lg border border-border/70 bg-background px-3 py-2.5"
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium">v{version.version}</span>
												{isCurrent && (
													<Badge variant="secondary">
														{t("emailDesigner.versionHistory.current", "Current")}
													</Badge>
												)}
											</div>
											{!isCurrent && (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs"
													disabled={isRestoringVersion}
													onClick={() => void handleRestore(version.version)}
												>
													{isRestoringThisVersion ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<RotateCcw className="h-3.5 w-3.5" />
													)}
													{t("emailDesigner.versionHistory.restore", "Restore")}
												</Button>
											)}
										</div>
										<div className="mt-1 text-xs text-muted-foreground">
											<span>{formatDateTime(version.createdAt || version.publishedAt)}</span>
											{version.createdBy && (
												<span className="ml-2">
													{t("emailDesigner.versionHistory.by", "by")}{" "}
													{createdByCurrentUser
														? t("emailDesigner.versionHistory.you", "you")
														: version.createdBy}
												</span>
											)}
										</div>
										{version.description && (
											<p className="mt-1 text-xs text-muted-foreground">{version.description}</p>
										)}
									</div>
								);
							})}
						</div>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	);
}

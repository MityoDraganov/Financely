import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, Mail, Phone, Globe } from "lucide-react";
import { EmailTemplateBlock } from "@/core";
import { cn } from "@/lib/utils";

interface MissingValue {
	id: string;
	type: "url" | "email" | "phone" | "unsubscribe";
	blockId: string;
	blockType: string;
	field: string;
	label: string;
}

interface EmailMissingValuesAlertProps {
	blocks: EmailTemplateBlock[];
	onNavigateToField: (blockId: string, field: string) => void;
}

export function EmailMissingValuesAlert({
	blocks,
	onNavigateToField,
}: EmailMissingValuesAlertProps) {
	const { t } = useTranslation();

	const missingValues = useMemo(() => {
		const missing: MissingValue[] = [];

		const checkBlock = (block: EmailTemplateBlock) => {
			// Check button blocks for placeholder URLs
			if (block.type === "button") {
				const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
				if (
					buttonBlock.url === "#" ||
					buttonBlock.url === "https://example.com" ||
					buttonBlock.url === "" ||
					!buttonBlock.url ||
					buttonBlock.url.startsWith("https://example")
				) {
					missing.push({
						id: `${block.id}-url`,
						type: "url",
						blockId: block.id,
						blockType: "button",
						field: "url",
						label: t("emailDesigner.missingValues.buttonUrl", {
							label: buttonBlock.label || t("emailDesigner.blocks.button"),
						}),
					});
				}
			}

			// Check logo blocks for placeholder URLs
			if (block.type === "logo") {
				const logoBlock = block as Extract<EmailTemplateBlock, { type: "logo" }>;
				if (
					logoBlock.link === "#" ||
					logoBlock.link === "https://example.com" ||
					logoBlock.link === "" ||
					!logoBlock.link
				) {
					// Logo link is optional, so we don't always flag it
					// Only flag if it's explicitly set to a placeholder
					if (logoBlock.link === "#" || logoBlock.link === "https://example.com") {
						missing.push({
							id: `${block.id}-link`,
							type: "url",
							blockId: block.id,
							blockType: "logo",
							field: "link",
							label: t("emailDesigner.missingValues.logoLink"),
						});
					}
				}
			}

			// Check navigation blocks
			if (block.type === "navigation") {
				const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
				navBlock.links?.forEach((link, index) => {
					if (
						link.url === "#" ||
						link.url === "https://example.com" ||
						link.url === "" ||
						!link.url ||
						link.url.startsWith("https://example")
					) {
						missing.push({
							id: `${block.id}-link-${index}`,
							type: "url",
							blockId: block.id,
							blockType: "navigation",
							field: `links.${index}.url`,
							label: t("emailDesigner.missingValues.navigationLink", {
								label: link.label || t("emailDesigner.blocks.navigation"),
							}),
						});
					}
				});
			}

			// Check unsubscribe blocks
			if (block.type === "unsubscribe") {
				const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
				if (
					unsubscribeBlock.url === "#unsubscribe" ||
					unsubscribeBlock.url === "#" ||
					unsubscribeBlock.url === "https://example.com" ||
					unsubscribeBlock.url === "" ||
					!unsubscribeBlock.url ||
					unsubscribeBlock.url.startsWith("https://example")
				) {
					missing.push({
						id: `${block.id}-url`,
						type: "unsubscribe",
						blockId: block.id,
						blockType: "unsubscribe",
						field: "url",
						label: t("emailDesigner.missingValues.unsubscribeUrl"),
					});
				}
			}

			// Check footerText blocks for email/phone placeholders
			if (block.type === "footerText") {
				const footerTextBlock = block as Extract<EmailTemplateBlock, { type: "footerText" }>;
				const content = footerTextBlock.content || "";
				// Check for email placeholders
				if (content.includes("email@example.com") || content.includes("mailto:#")) {
					missing.push({
						id: `${block.id}-email`,
						type: "email",
						blockId: block.id,
						blockType: "footerText",
						field: "content",
						label: t("emailDesigner.missingValues.footerEmail"),
					});
				}
				// Check for phone placeholders
				if (content.includes("+1 234 567 8900") || content.includes("phone: #")) {
					missing.push({
						id: `${block.id}-phone`,
						type: "phone",
						blockId: block.id,
						blockType: "footerText",
						field: "content",
						label: t("emailDesigner.missingValues.footerPhone"),
					});
				}
			}

			// Check nested blocks (columns, container)
			if (block.type === "columns") {
				const columnsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
				columnsBlock.columns?.forEach((column) => {
					column.blocks?.forEach((nestedBlock) => {
						checkBlock(nestedBlock);
					});
				});
			}

			if (block.type === "container") {
				const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
				containerBlock.blocks?.forEach((nestedBlock) => {
					checkBlock(nestedBlock);
				});
			}
		};

		blocks.forEach((block) => {
			checkBlock(block);
		});

		return missing;
	}, [blocks, t]);

	if (missingValues.length === 0) {
		return null;
	}

	const getIcon = (type: MissingValue["type"]) => {
		switch (type) {
			case "url":
				return <Globe className="h-4 w-4" />;
			case "email":
				return <Mail className="h-4 w-4" />;
			case "phone":
				return <Phone className="h-4 w-4" />;
			case "unsubscribe":
				return <ExternalLink className="h-4 w-4" />;
			default:
				return <AlertCircle className="h-4 w-4" />;
		}
	};

	return (
		<Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
			<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
			<AlertTitle className="text-amber-900 dark:text-amber-100">
				{t("emailDesigner.missingValues.title")}
			</AlertTitle>
			<AlertDescription className="mt-2 space-y-2">
				<p className="text-sm text-amber-800 dark:text-amber-200">
					{t("emailDesigner.missingValues.description", { count: missingValues.length })}
				</p>
				<div className="space-y-1.5">
					{missingValues.map((missing) => (
						<Button
							key={missing.id}
							variant="ghost"
							size="sm"
							className={cn(
								"w-full justify-start text-left h-auto py-2 px-3",
								"text-amber-900 dark:text-amber-100",
								"hover:bg-amber-100 dark:hover:bg-amber-900",
								"border border-amber-200 dark:border-amber-800"
							)}
							onClick={() => {
								onNavigateToField(missing.blockId, missing.field);
							}}
						>
							<div className="flex items-start gap-2 w-full">
								{getIcon(missing.type)}
								<span className="text-xs flex-1">{missing.label}</span>
							</div>
						</Button>
					))}
				</div>
			</AlertDescription>
		</Alert>
	);
}






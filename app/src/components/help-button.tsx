import { useTranslation } from "react-i18next";
import { HelpCircle, BookOpen, Code2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DOCS_USER_URL = "https://docs.financely.app/user-manual/introduction";
const DOCS_DEVELOPER_URL = "https://docs.financely.app/developers/introduction";

export function HelpButton() {
	const { t } = useTranslation();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="fixed bottom-5 right-5 z-50 h-10 w-10 rounded-full shadow-md border border-border bg-background hover:bg-muted"
					aria-label={t("help.openMenu", "Help")}
				>
					<HelpCircle className="h-5 w-5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="end" className="w-52 mb-1">
				<DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
					{t("help.menuLabel", "Documentation")}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<a
						href={DOCS_USER_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 cursor-pointer"
					>
						<BookOpen className="h-4 w-4 shrink-0" />
						<span className="flex-1">{t("help.userManual", "User manual")}</span>
						<ExternalLink className="h-3 w-3 text-muted-foreground" />
					</a>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<a
						href={DOCS_DEVELOPER_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 cursor-pointer"
					>
						<Code2 className="h-4 w-4 shrink-0" />
						<span className="flex-1">{t("help.developerDocs", "Developer docs")}</span>
						<ExternalLink className="h-3 w-3 text-muted-foreground" />
					</a>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

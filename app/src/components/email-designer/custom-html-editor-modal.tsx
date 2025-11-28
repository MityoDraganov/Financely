import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmailHtmlEditor } from "./email-html-editor";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CustomHtmlEditorModalProps {
	isOpen: boolean;
	onClose: () => void;
	html: string;
	onSave: (html: string) => void;
}

export function CustomHtmlEditorModal({
	isOpen,
	onClose,
	html: initialHtml,
	onSave,
}: CustomHtmlEditorModalProps) {
	const { t } = useTranslation();
	const [html, setHtml] = useState(initialHtml);
	const hasChangesRef = useRef(false);

	// Reset HTML when modal opens with new content
	useEffect(() => {
		if (isOpen) {
			setHtml(initialHtml);
			hasChangesRef.current = false;
		}
	}, [isOpen, initialHtml]);

	const handleHtmlChange = (newHtml: string) => {
		setHtml(newHtml);
		hasChangesRef.current = newHtml !== initialHtml;
	};

	const handleSave = () => {
		onSave(html);
		hasChangesRef.current = false;
		onClose();
	};

	const handleClose = () => {
		if (hasChangesRef.current) {
			// If there are unsaved changes, save them before closing
			handleSave();
		} else {
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col p-0">
				<DialogHeader className="px-6 py-4 border-b shrink-0">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onClick={handleClose}
							className="h-8 w-8"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<DialogTitle className="text-lg font-semibold">
							{t("emailDesigner.customHtml.editTitle")}
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						{t("emailDesigner.customHtml.editDescription")}
					</p>
				</DialogHeader>
				<div className="flex-1 flex flex-col min-h-0 px-6 py-4">
					<div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
						<EmailHtmlEditor
							html={html}
							onChange={handleHtmlChange}
						/>
					</div>
					<div className="flex items-center justify-end gap-2 mt-4 shrink-0">
						<Button variant="outline" onClick={handleClose}>
							{t("common.cancel")}
						</Button>
						<Button onClick={handleSave}>
							{t("common.save")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}


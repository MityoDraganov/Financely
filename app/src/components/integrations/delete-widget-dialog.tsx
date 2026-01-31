import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface DeleteWidgetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	widgetId: string | null;
	onConfirm: (widgetId: string) => Promise<void>;
}

export function DeleteWidgetDialog({
	open,
	onOpenChange,
	widgetId,
	onConfirm,
}: DeleteWidgetDialogProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const handleConfirm = async () => {
		if (!widgetId) return;
		setIsDeleting(true);
		try {
			await onConfirm(widgetId);
			onOpenChange(false);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleOpenChange = (next: boolean) => {
		if (!next && !isDeleting) {
			onOpenChange(false);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete widget</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently remove this widget. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<Button
						type="button"
						variant="destructive"
						disabled={isDeleting}
						onClick={() => void handleConfirm()}
					>
						{isDeleting ? (
							<span className="inline-flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Deleting…
							</span>
						) : (
							"Delete"
						)}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

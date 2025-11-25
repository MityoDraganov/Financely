import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Upload, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type BrandAssets = {
	logo?: string;
	favicon?: string;
	gallery: string[];
};

type UploadState = {
	preview: string;
	progress: number;
};

type BrandImagePickerDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	assets: BrandAssets;
	onSelect: (url: string) => void;
	onUploadImage: (file: File) => Promise<void>;
	isUploading?: boolean;
	uploadState?: UploadState | null;
};

export function BrandImagePickerDialog({
	open,
	onOpenChange,
	assets,
	onSelect,
	onUploadImage,
	isUploading = false,
	uploadState,
}: BrandImagePickerDialogProps) {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			await onUploadImage(file);
		}
		// Reset input to allow re-uploading same file
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const quickAssets = [
		assets.logo && {
			label: t("emailDesigner.imagePicker.logo"),
			url: assets.logo,
		},
		assets.favicon && {
			label: t("emailDesigner.imagePicker.favicon"),
			url: assets.favicon,
		},
	].filter(Boolean) as { label: string; url: string }[];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto pb-8 flex flex-col">
				<DialogHeader className="shrink-0">
					<DialogTitle>{t("emailDesigner.imagePicker.title")}</DialogTitle>
					<DialogDescription>
						{t("emailDesigner.imagePicker.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col min-h-0 space-y-4">
					<div className="shrink-0 rounded-lg border border-dashed border-muted-foreground/40 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium">
								{t("emailDesigner.imagePicker.uploadTitle")}
							</p>
							<p className="text-xs text-muted-foreground">
								{t("emailDesigner.imagePicker.uploadHint")}
							</p>
						</div>
						<div className="flex items-center gap-3">
							{uploadState && (
								<div className="relative w-20 h-20 rounded-lg overflow-hidden border">
									<img
										src={uploadState.preview}
										alt={t("emailDesigner.imagePicker.uploadPreviewAlt")}
										className="h-full w-full object-cover"
									/>
									<div className="absolute inset-0 bg-black/60 flex items-center justify-center">
										<CircularUploadProgress value={uploadState.progress} />
									</div>
								</div>
							)}
							<Button
								type="button"
								variant="outline"
								onClick={() => fileInputRef.current?.click()}
								disabled={isUploading}
								className="gap-2"
							>
								<Upload className="h-4 w-4" />
								{isUploading
									? t("emailDesigner.imagePicker.uploading")
									: t("emailDesigner.imagePicker.uploadCta")}
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleFileChange}
							/>
						</div>
					</div>

					<ScrollArea className="flex-1 min-h-0 pr-4">
						<div className="space-y-6">
							{quickAssets.length > 0 && (
								<section className="space-y-3">
									<div>
										<p className="text-sm font-semibold">
											{t("emailDesigner.imagePicker.identitySection")}
										</p>
										<p className="text-xs text-muted-foreground">
											{t("emailDesigner.imagePicker.identityHint")}
										</p>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{quickAssets.map((asset) => (
											<ImageCard
												key={asset.label}
												label={asset.label}
												src={asset.url}
												onSelect={() => onSelect(asset.url)}
											/>
										))}
									</div>
								</section>
							)}

							<section className="space-y-3">
								<div>
									<p className="text-sm font-semibold">
										{t("emailDesigner.imagePicker.galleryTitle")}
									</p>
									<p className="text-xs text-muted-foreground">
										{t("emailDesigner.imagePicker.galleryHint")}
									</p>
								</div>
								{assets.gallery.length === 0 ? (
									<div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
										<ImageIcon className="mx-auto mb-3 h-6 w-6 opacity-70" />
										{t("emailDesigner.imagePicker.emptyState")}
									</div>
								) : (
									<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
										{assets.gallery.map((url) => (
											<ImageCard
												key={url}
												src={url}
												onSelect={() => onSelect(url)}
											/>
										))}
									</div>
								)}
							</section>
						</div>
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
}

type ImageCardProps = {
	src: string;
	label?: string;
	onSelect: () => void;
};

function ImageCard({ src, label, onSelect }: ImageCardProps) {
	const { t } = useTranslation();
	return (
		<div className="group relative rounded-lg border bg-card overflow-hidden">
			<img src={src} alt={label || ""} className="h-32 w-full object-cover" />
			<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
			<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
				{label && (
					<div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
						<Check className="h-3 w-3" />
						<span>{label}</span>
					</div>
				)}
				<Button
					type="button"
					size="sm"
					variant="secondary"
					className={cn(
						"ml-auto bg-white/90 text-foreground shadow-sm hover:bg-white",
						!label && "bg-white/90"
					)}
					onClick={onSelect}
				>
					{t("emailDesigner.imagePicker.useImage")}
				</Button>
			</div>
		</div>
	);
}

function CircularUploadProgress({ value }: { value: number }) {
	const radius = 18;
	const circumference = 2 * Math.PI * radius;
	const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
	const offset = circumference - (clampedValue / 100) * circumference;

	return (
		<div className="relative h-14 w-14">
			<svg
				className="-rotate-90 h-full w-full"
				viewBox="0 0 40 40"
				aria-hidden="true"
			>
				<circle
					className="text-white/30"
					stroke="currentColor"
					strokeWidth="4"
					fill="transparent"
					r={radius}
					cx="20"
					cy="20"
				/>
				<circle
					className="text-white"
					stroke="currentColor"
					strokeWidth="4"
					strokeLinecap="round"
					fill="transparent"
					r={radius}
					cx="20"
					cy="20"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
				/>
			</svg>
			<span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
				{clampedValue}%
			</span>
		</div>
	);
}


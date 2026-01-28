import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
	Search,
	Grid3x3,
	List,
	Upload,
	Image as ImageIcon,
	Video,
	File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useFiles } from "@/hooks/repository-hooks/use-files";
import { File } from "@/core";
import { toast } from "sonner";

interface SelectFileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (fileUrl: string | string[]) => void;
	organizationId: string;
	fieldType:
		| "file_reference"
		| "file_reference_image"
		| "file_reference_video";
	multiple?: boolean;
	currentValue?: string | string[];
}

export function SelectFileDialog({
	open,
	onOpenChange,
	onSelect,
	organizationId,
	fieldType,
	multiple = false,
	currentValue,
}: SelectFileDialogProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
	const [recentlyUploadedFiles, setRecentlyUploadedFiles] = useState<
		Array<{
			url: string;
			filename: string;
			contentType: string;
			fileType: "IMAGE" | "VIDEO" | "GENERIC";
		}>
	>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { uploadFile, isUploading, error: uploadError } = useFileUpload();

	if (uploadError) {
		console.error(uploadError);
	}

	// Load existing files from Firestore (if they exist - optional for file management)
	// For metaobject file references, we primarily use recently uploaded files
	const { data: files = [], isLoading } = useFiles(organizationId);

	const currentUrls = useMemo(() => {
		if (!currentValue) return new Set<string>();
		return new Set(
			Array.isArray(currentValue) ? currentValue : [currentValue],
		);
	}, [currentValue]);

	// Initialize selectedUrls from currentValue when dialog opens
	useEffect(() => {
		if (open) {
			if (currentValue) {
				const urls = Array.isArray(currentValue)
					? currentValue
					: [currentValue];
				setSelectedUrls(new Set(urls));
			} else {
				setSelectedUrls(new Set());
			}
			// Clear recently uploaded files when dialog opens
			setRecentlyUploadedFiles([]);
		}
	}, [open, currentValue]);

	// Combine files from Firestore with recently uploaded files
	const allFiles = useMemo(() => {
		const fileMap = new Map<string, File>();

		// Add files from Firestore
		files.forEach((file) => {
			fileMap.set(file.url, file);
		});

		// Add recently uploaded files that aren't in Firestore yet
		recentlyUploadedFiles.forEach((recentFile) => {
			if (!fileMap.has(recentFile.url)) {
				// Create a temporary File-like object
				fileMap.set(recentFile.url, {
					id: `temp-${recentFile.url}`,
					organizationId,
					filename: recentFile.filename,
					originalFilename: recentFile.filename,
					url: recentFile.url,
					contentType: recentFile.contentType,
					fileType: recentFile.fileType,
					fileStatus: "READY",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				} as File);
			}
		});

		return Array.from(fileMap.values());
	}, [files, recentlyUploadedFiles, organizationId]);

	const filteredFiles = useMemo(() => {
		return allFiles.filter((file) => {
			if (searchTerm.trim()) {
				const searchLower = searchTerm.toLowerCase();
				const filename = (file.filename || "").toLowerCase();
				const originalFilename = (
					file.originalFilename || ""
				).toLowerCase();
				return (
					filename.includes(searchLower) ||
					originalFilename.includes(searchLower)
				);
			}
			return true;
		});
	}, [allFiles, searchTerm]);

	const handleFileSelect = useCallback(
		(fileUrl: string) => {
			const newSelected = new Set(selectedUrls);
			if (newSelected.has(fileUrl)) {
				newSelected.delete(fileUrl);
			} else {
				if (!multiple) {
					newSelected.clear();
				}
				newSelected.add(fileUrl);
			}
			setSelectedUrls(newSelected);
		},
		[selectedUrls, multiple],
	);

	const handleAddFiles = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const getFileType = (
		contentType: string,
	): "IMAGE" | "VIDEO" | "GENERIC" => {
		if (contentType.startsWith("image/")) return "IMAGE";
		if (contentType.startsWith("video/")) return "VIDEO";
		return "GENERIC";
	};

	const handleFileInputChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const fileList = e.target.files;
			if (!fileList || fileList.length === 0) return;

			const uploadPromises: Promise<{
				url: string;
				originalFile: globalThis.File;
			} | null>[] = [];

			for (let i = 0; i < fileList.length; i++) {
				const file = fileList[i];
				const timestamp = Date.now();
				const path = `organizations/${organizationId}/files/${timestamp}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

				uploadPromises.push(
					uploadFile(file, path).then((url) => {
						if (url) {
							return { url, originalFile: file };
						}
						return null;
					}),
				);
			}

			try {
				const results = await Promise.all(uploadPromises);
				const successful = results.filter(
					(r): r is { url: string; originalFile: globalThis.File } =>
						r !== null,
				);

				if (successful.length > 0) {
					// Add to recently uploaded files for immediate display
					// No Firestore entities needed - we just store Storage URLs in metaobject fields
					const newRecentFiles = successful.map(
						({ url, originalFile }) => ({
							url,
							filename: originalFile.name.replace(
								/[^a-zA-Z0-9.-]/g,
								"_",
							),
							contentType: originalFile.type,
							fileType: getFileType(originalFile.type),
						}),
					);
					setRecentlyUploadedFiles((prev) => [
						...prev,
						...newRecentFiles,
					]);

					toast.success(
						`Successfully uploaded ${successful.length} file(s)`,
					);
					const newSelected = new Set(selectedUrls);
					successful.forEach(({ url }) => {
						if (!multiple && newSelected.size > 0) {
							newSelected.clear();
						}
						newSelected.add(url);
					});
					setSelectedUrls(newSelected);
				} else {
					toast.error("Failed to upload files");
				}
			} catch (error) {
				toast.error("Failed to upload files");
				console.error(error);
			}

			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		},
		[organizationId, uploadFile, selectedUrls, multiple],
	);

	const handleDone = useCallback(() => {
		if (selectedUrls.size === 0) return;
		const urlsArray = Array.from(selectedUrls);
		onSelect(multiple ? urlsArray : urlsArray[0]);
		onOpenChange(false);
	}, [selectedUrls, multiple, onSelect, onOpenChange]);

	const handleCancel = useCallback(() => {
		setSelectedUrls(currentUrls);
		onOpenChange(false);
	}, [currentUrls, onOpenChange]);

	const getFileIcon = (file: File) => {
		if (file.fileType === "IMAGE") return ImageIcon;
		if (file.fileType === "VIDEO" || file.fileType === "EXTERNAL_VIDEO")
			return Video;
		return FileIcon;
	};

	const getFileTypeLabel = (file: File) => {
		if (file.contentType) {
			const parts = file.contentType.split("/");
			return parts[parts.length - 1].toUpperCase();
		}
		return file.fileType || "FILE";
	};

	return (
		<Dialog open={open} onOpenChange={handleCancel}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>
						Select{" "}
						{fieldType === "file_reference_image"
							? "image"
							: fieldType === "file_reference_video"
								? "video"
								: "file"}
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-hidden flex flex-col space-y-4">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
							<Input
								placeholder="Search files..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>
						{fieldType === "file_reference" && (
							<Select
								value={fileTypeFilter}
								onValueChange={setFileTypeFilter}
							>
								<SelectTrigger className="w-[140px]">
									<SelectValue placeholder="File type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">
										All Types
									</SelectItem>
									<SelectItem value="IMAGE">
										Images
									</SelectItem>
									<SelectItem value="VIDEO">
										Videos
									</SelectItem>
									<SelectItem value="GENERIC">
										Generic
									</SelectItem>
								</SelectContent>
							</Select>
						)}
						<div className="flex items-center gap-1 border rounded-md p-1">
							<Button
								type="button"
								variant={
									viewMode === "grid" ? "secondary" : "ghost"
								}
								size="sm"
								onClick={() => setViewMode("grid")}
								className="h-8 w-8 p-0"
							>
								<Grid3x3 className="h-4 w-4" />
							</Button>
							<Button
								type="button"
								variant={
									viewMode === "list" ? "secondary" : "ghost"
								}
								size="sm"
								onClick={() => setViewMode("list")}
								className="h-8 w-8 p-0"
							>
								<List className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								Drag and drop files here
							</p>
							<Button
								type="button"
								variant="outline"
								onClick={handleAddFiles}
								disabled={isUploading}
								className="w-full sm:w-auto"
							>
								<Upload className="h-4 w-4 mr-2" />
								{isUploading ? "Uploading..." : "Add files"}
							</Button>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							className="hidden"
							onChange={handleFileInputChange}
							accept={
								fieldType === "file_reference_image"
									? "image/*"
									: fieldType === "file_reference_video"
										? "video/*"
										: undefined
							}
						/>
					</div>

					<div className="flex-1 overflow-y-auto">
						{isLoading ? (
							<div className="flex items-center justify-center p-8">
								Loading files...
							</div>
						) : filteredFiles.length === 0 ? (
							<div className="flex items-center justify-center p-8 text-muted-foreground">
								No files found
							</div>
						) : (
							<div
								className={
									viewMode === "grid"
										? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
										: "space-y-2"
								}
							>
								{filteredFiles.map((file) => {
									const isSelected =
										selectedUrls.has(file.url) ||
										currentUrls.has(file.url);
									const FileIconComponent = getFileIcon(file);
									const fileTypeLabel =
										getFileTypeLabel(file);

									return (
										<div
											key={file.id}
											className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
												isSelected
													? "ring-2 ring-primary"
													: "hover:border-primary"
											}`}
											onClick={() =>
												handleFileSelect(file.url)
											}
										>
											<div className="absolute top-2 left-2 z-10">
												<Checkbox
													checked={isSelected}
													onCheckedChange={() =>
														handleFileSelect(
															file.url,
														)
													}
												/>
											</div>
											{viewMode === "grid" ? (
												<div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
													{file.fileType ===
														"IMAGE" && file.url ? (
														<img
															src={file.url}
															alt={
																file.alt ||
																file.filename
															}
															className="w-full h-full object-cover"
														/>
													) : file.fileType ===
															"VIDEO" &&
													  file.url ? (
														<video
															src={file.url}
															className="w-full h-full object-cover"
															muted
															preload="metadata"
														/>
													) : (
														<FileIconComponent className="h-12 w-12 text-muted-foreground" />
													)}
												</div>
											) : (
												<div className="p-3 flex items-center gap-3">
													<div className="h-12 w-12 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
														{file.fileType ===
															"IMAGE" &&
														file.url ? (
															<img
																src={file.url}
																alt={
																	file.alt ||
																	file.filename
																}
																className="w-full h-full object-cover rounded"
															/>
														) : file.fileType ===
																"VIDEO" &&
														  file.url ? (
															<video
																src={file.url}
																className="w-full h-full object-cover rounded"
																muted
																preload="metadata"
															/>
														) : (
															<FileIconComponent className="h-6 w-6 text-muted-foreground" />
														)}
													</div>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium truncate">
															{file.filename}
														</p>
														<p className="text-xs text-muted-foreground">
															{fileTypeLabel}
														</p>
													</div>
												</div>
											)}
											{viewMode === "grid" && (
												<div className="p-2 border-t">
													<p className="text-xs font-medium truncate">
														{file.filename}
													</p>
													<p className="text-xs text-muted-foreground">
														{fileTypeLabel}
													</p>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						onClick={handleDone}
						disabled={selectedUrls.size === 0}
					>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

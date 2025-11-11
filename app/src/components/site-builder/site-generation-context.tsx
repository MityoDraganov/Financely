import { useRef } from "react";
import { ImageIcon, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface SiteGenerationContextProps {
  context: string;
  onContextChange: (value: string) => void;
  contextImages: string[];
  onContextImageUpload: (file: File) => Promise<void>;
  onContextImageRemove: (index: number) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
}

export function SiteGenerationContext({
  context,
  onContextChange,
  contextImages,
  onContextImageUpload,
  onContextImageRemove,
  isUploading,
  uploadProgress,
  uploadError,
}: SiteGenerationContextProps) {
  const contextUploadRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 border-b border-gray-200 pb-4">
      <Label>Context & Instructions (Optional)</Label>
      <Textarea
        value={context}
        onChange={(e) => onContextChange(e.target.value)}
        placeholder="Provide additional context, tasks, or instructions for the AI site builder..."
        className="min-h-[100px]"
      />
      <div className="space-y-2">
        <Label className="text-sm">Context Images (Optional)</Label>
        <input
          ref={contextUploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onContextImageUpload(file);
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          {contextImages.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Context ${index + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-5 w-5 rounded-full bg-white shadow-sm hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onContextImageRemove(index)}
              >
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          ))}
          <div
            onClick={() => contextUploadRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg w-20 h-20 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
          >
            <ImageIcon className="h-6 w-6 text-gray-400" />
          </div>
        </div>
        {isUploading && (
          <p className="text-sm text-gray-500">
            Uploading... {uploadProgress}%
          </p>
        )}
        {uploadError && (
          <p className="text-sm text-red-600">{uploadError}</p>
        )}
        <p className="text-xs text-gray-500">
          These images are only used for AI context and are not saved to your brand gallery.
        </p>
      </div>
    </div>
  );
}


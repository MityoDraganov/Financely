import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Sparkles, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { useUploadFile } from "@/hooks/service-hooks/use-upload-file";
import { LanguageSelector } from "./language-selector";
import { languages, getLanguageByCode } from "@/utils/languages";
import { toast } from "sonner";
import { RichTextEditor } from "./rich-text-editor";

interface ArticleLocalization {
  title: string;
  description: string; // Rich text HTML
  summary?: string;
  image?: string; // Featured image URL
}

interface PageContentEntry {
  id: string;
  title: string;
  summary?: string;
  link?: string;
  image?: string;
  description?: string; // Rich text HTML for AI
  localization?: {
    defaultLanguage: "en";
    languages: Record<string, ArticleLocalization>;
  };
}

interface AddArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (article: {
    title: string;
    summary: string;
    link: string;
    image: string;
    description: string;
    localization?: {
      defaultLanguage: "en";
      languages: Record<string, ArticleLocalization>;
    };
  }) => void;
  isPending?: boolean;
  initialValues?: PageContentEntry | null;
  mode?: "create" | "edit";
  brandSiteId?: string | null;
  organizationId?: string;
}

const defaultFormState = {
  title: "",
  summary: "",
  link: "",
  image: "",
  description: "",
  localization: {
    defaultLanguage: "en" as const,
    languages: {} as Record<string, ArticleLocalization>,
  },
};

export function AddArticleDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  initialValues = null,
  mode = "create",
  brandSiteId,
  organizationId,
}: AddArticleDialogProps) {
  const [form, setForm] = useState(defaultFormState);
  const [activeTab, setActiveTab] = useState<string>("en");
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(["en"]);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<Record<string, { progress: number; preview: string }>>({});
  const uploadFile = useUploadFile();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isEditMode = mode === "edit";
  const descriptionText = isEditMode
    ? "Update the article details."
    : "Add a new article to this blog page.";
  const submitLabel = isPending
    ? isEditMode
      ? "Saving..."
      : "Adding..."
    : isEditMode
      ? "Save Changes"
      : "Add Article";

  useEffect(() => {
    if (!open) {
      setForm(defaultFormState);
      setActiveTab("en");
      setAvailableLanguages(["en"]);
      return;
    }

    if (isEditMode && initialValues) {
      setForm({
        title: initialValues.title || "",
        summary: initialValues.summary || "",
        link: initialValues.link || "",
        image: initialValues.image || "",
        description: initialValues.description || "",
        localization: initialValues.localization || {
          defaultLanguage: "en",
          languages: {},
        },
      });
      
      // Set available languages from localization
      const locLangs = Object.keys(initialValues.localization?.languages || {});
      if (locLangs.length > 0) {
        setAvailableLanguages(["en", ...locLangs]);
      }
    } else {
      setForm(defaultFormState);
    }
  }, [open, isEditMode, initialValues]);

  const handleAddLanguage = (languageCode: string) => {
    if (availableLanguages.includes(languageCode)) {
      toast.error("This language is already added");
      return;
    }

    setAvailableLanguages([...availableLanguages, languageCode]);
    setActiveTab(languageCode);
    
    // Initialize localization for this language
    setForm((prev) => ({
      ...prev,
      localization: {
        ...prev.localization,
        languages: {
          ...prev.localization.languages,
          [languageCode]: {
            title: "",
            description: "",
            summary: "",
            image: prev.image, // Use default image as fallback
          },
        },
      },
    }));
  };

  const handleRemoveLanguage = (languageCode: string) => {
    if (languageCode === "en") {
      toast.error("Cannot remove the default language (English)");
      return;
    }

    setAvailableLanguages(availableLanguages.filter((lang) => lang !== languageCode));
    if (activeTab === languageCode) {
      setActiveTab("en");
    }

    setForm((prev) => {
      const newLanguages = { ...prev.localization.languages };
      delete newLanguages[languageCode];
      return {
        ...prev,
        localization: {
          ...prev.localization,
          languages: newLanguages,
        },
      };
    });
  };

  const updateLocalization = (languageCode: string, field: keyof ArticleLocalization, value: string) => {
    setForm((prev) => ({
      ...prev,
      localization: {
        ...prev.localization,
        languages: {
          ...prev.localization.languages,
          [languageCode]: {
            ...prev.localization.languages[languageCode],
            [field]: value,
          },
        },
      },
    }));
  };

  const handleImageUpload = async (file: File, languageCode: string = "en") => {
    if (!organizationId) {
      toast.error("Organization ID is required");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB");
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    const uploadId = `upload-${languageCode}-${Date.now()}`;
    
    // Add to uploading images
    setUploadingImages((prev) => ({
      ...prev,
      [uploadId]: { progress: 0, preview },
    }));

    let progressInterval: NodeJS.Timeout | null = null;
    
    try {
      // Simulate progress updates
      progressInterval = setInterval(() => {
        setUploadingImages((prev) => {
          const current = prev[uploadId];
          if (!current) return prev;
          const newProgress = Math.min(current.progress + 10, 90);
          return {
            ...prev,
            [uploadId]: { ...current, progress: newProgress },
          };
        });
      }, 200);

      // Update initial progress
      setUploadingImages((prev) => ({
        ...prev,
        [uploadId]: { progress: 10, preview },
      }));

      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via backend cloud function
      const result = await uploadFile.mutateAsync({
        organizationId,
        fileName: file.name,
        fileData,
        contentType: file.type,
        path: `organizations/${organizationId}/articles/${Date.now()}-${file.name}`,
      });

      // Clear progress interval
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Update to 100%
      setUploadingImages((prev) => ({
        ...prev,
        [uploadId]: { progress: 100, preview },
      }));

      // Remove from uploading after a short delay
      setTimeout(() => {
        setUploadingImages((prev) => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
        URL.revokeObjectURL(preview);
      }, 500);

      // Update form with the uploaded URL
      if (languageCode === "en") {
        setForm((prev) => ({ ...prev, image: result.url }));
        toast.success("Image uploaded");
      } else {
        updateLocalization(languageCode, "image", result.url);
        toast.success("Image uploaded");
      }
    } catch (error) {
      // Clear progress interval on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Remove from uploading
      setUploadingImages((prev) => {
        const next = { ...prev };
        delete next[uploadId];
        return next;
      });
      URL.revokeObjectURL(preview);

      toast.error("Failed to upload image");
      console.error("Image upload error:", error);
    }
  };

  const handleAIAssistance = async (languageCode: string = "en") => {
    if (!brandSiteId || !organizationId) {
      toast.error("Brand site and organization are required for AI assistance");
      return;
    }

    const currentTitle = languageCode === "en" 
      ? form.title 
      : form.localization.languages[languageCode]?.title || "";
    const currentDescription = languageCode === "en"
      ? form.description
      : form.localization.languages[languageCode]?.description || "";

    if (!currentTitle.trim()) {
      toast.error("Please enter a title first");
      return;
    }

    setIsAIGenerating(true);
    try {
      // Use chatGenerateSite as a simple way to get AI text generation
      // In the future, this could be replaced with a dedicated text generation endpoint
      const prompt = `Write a professional blog article description for the title "${currentTitle}". 
${currentDescription ? `Current description: ${currentDescription}` : ""}
Requirements:
- Write in ${languageCode === "en" ? "English" : getLanguageByCode(languageCode)?.name || "the selected language"}
- Use rich HTML formatting (bold, italic, colors, lists, etc.)
- Make it engaging and professional
- 2-3 paragraphs
- Include relevant keywords naturally
- Return ONLY the HTML content, no explanations`;

      // TODO: Create a dedicated text generation Cloud Function endpoint
      // For now, use a simple approach - we'll create the endpoint later
      // This is a placeholder that shows the feature is coming
      toast.info("AI writing assistance feature coming soon! For now, you can manually format text using HTML tags like <b>bold</b>, <i>italic</i>, and <span style='color: red'>colored text</span>.");
      setIsAIGenerating(false);
      return;
    } catch (error) {
      toast.error("Failed to generate description with AI");
      console.error("AI assistance error:", error);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    onSubmit({
      title: form.title,
      summary: form.summary,
      link: form.link,
      image: form.image,
      description: form.description,
      localization: Object.keys(form.localization.languages).length > 0 
        ? form.localization 
        : undefined,
    });
  };

  const currentLocalization = activeTab === "en"
    ? null
    : form.localization.languages[activeTab];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit article" : "Add article"}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              {availableLanguages.map((langCode) => {
                const lang = langCode === "en" 
                  ? { code: "en", name: "English", flag: "🇺🇸" }
                  : getLanguageByCode(langCode);
                return (
                  <TabsTrigger key={langCode} value={langCode} className="gap-2">
                    <span>{lang?.flag}</span>
                    <span>{lang?.name}</span>
                    {langCode !== "en" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLanguage(langCode);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <div className="flex items-center gap-2">
              <LanguageSelector
                value=""
                onValueChange={handleAddLanguage}
                excludedLanguages={availableLanguages}
                placeholder="Add language..."
                className="w-[200px]"
              />
            </div>
          </div>

          {availableLanguages.map((langCode) => (
            <TabsContent key={langCode} value={langCode} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={langCode === "en" 
                      ? form.title 
                      : form.localization.languages[langCode]?.title || ""}
                    onChange={(e) => {
                      if (langCode === "en") {
                        setForm((prev) => ({ ...prev, title: e.target.value }));
                      } else {
                        updateLocalization(langCode, "title", e.target.value);
                      }
                    }}
                    placeholder="Article title"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Description (Rich Text) *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAIAssistance(langCode)}
                      disabled={isAIGenerating || !brandSiteId}
                      className="gap-2"
                    >
                      {isAIGenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          AI Writing Assistance
                        </>
                      )}
                    </Button>
                  </div>
                  <RichTextEditor
                    content={langCode === "en"
                      ? form.description
                      : currentLocalization?.description || ""}
                    onChange={(html) => {
                      if (langCode === "en") {
                        setForm((prev) => ({ ...prev, description: html }));
                      } else {
                        updateLocalization(langCode, "description", html);
                      }
                    }}
                    placeholder="Start typing your article description..."
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    This description is used directly by AI. Format text using the toolbar above.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Summary (optional)</Label>
                  <Textarea
                    value={langCode === "en"
                      ? form.summary
                      : form.localization.languages[langCode]?.summary || ""}
                    onChange={(e) => {
                      if (langCode === "en") {
                        setForm((prev) => ({ ...prev, summary: e.target.value }));
                      } else {
                        updateLocalization(langCode, "summary", e.target.value);
                      }
                    }}
                    placeholder="Brief summary or excerpt..."
                    rows={3}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link (optional)</Label>
                  <Input
                    value={langCode === "en" ? form.link : form.localization.languages[langCode]?.link || ""}
                    onChange={(e) => {
                      if (langCode === "en") {
                        setForm((prev) => ({ ...prev, link: e.target.value }));
                      } else {
                        updateLocalization(langCode, "link", e.target.value);
                      }
                    }}
                    placeholder="https://example.com/article"
                    type="url"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Featured Image</Label>
                  
                  {/* Image previews and upload area */}
                  <div className="flex flex-wrap gap-2">
                    {/* Show uploaded image if exists */}
                    {((langCode === "en" ? form.image : currentLocalization?.image) || form.image) && 
                     !Object.keys(uploadingImages).some(id => id.startsWith(`upload-${langCode}-`)) && (
                      <div className="relative group w-24 h-24 rounded-lg border overflow-visible">
                        <img
                          src={langCode === "en" 
                            ? form.image 
                            : (currentLocalization?.image || form.image)}
                          alt="Featured"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md"
                          onClick={() => {
                            if (langCode === "en") {
                              setForm((prev) => ({ ...prev, image: "" }));
                            } else {
                              updateLocalization(langCode, "image", "");
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Show uploading images with progress */}
                    {Object.entries(uploadingImages)
                      .filter(([id]) => id.startsWith(`upload-${langCode}-`))
                      .map(([id, uploading]) => (
                        <div
                          key={id}
                          className="relative group w-24 h-24 rounded-lg border-2 border-dashed border-muted overflow-visible"
                        >
                          <div className="w-full h-full rounded-lg overflow-hidden">
                            <img
                              src={uploading.preview}
                              alt="Uploading"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* Progress overlay */}
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg">
                            <Loader2 className="h-5 w-5 animate-spin text-white mb-1" />
                            <span className="text-xs text-white font-medium">
                              {uploading.progress}%
                            </span>
                          </div>
                          {/* Remove button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md"
                            onClick={() => {
                              setUploadingImages((prev) => {
                                const next = { ...prev };
                                URL.revokeObjectURL(uploading.preview);
                                delete next[id];
                                return next;
                              });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                    {/* Upload button / area */}
                    <div
                      onClick={() => {
                        const inputId = `file-input-${langCode}`;
                        let input = fileInputRefs.current[inputId];
                        if (!input) {
                          input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*";
                          input.style.display = "none";
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              handleImageUpload(file, langCode);
                            }
                            // Reset input
                            input.value = "";
                          };
                          document.body.appendChild(input);
                          fileInputRefs.current[inputId] = input;
                        }
                        input.click();
                      }}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-lg w-24 h-24 cursor-pointer hover:border-primary transition-colors bg-muted/50"
                    >
                      {uploadFile.isPending ? (
                        <>
                          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mb-1" />
                          <span className="text-xs text-muted-foreground">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Manual URL input */}
                  <Input
                    value={langCode === "en"
                      ? form.image
                      : currentLocalization?.image || ""}
                    onChange={(e) => {
                      if (langCode === "en") {
                        setForm((prev) => ({ ...prev, image: e.target.value }));
                      } else {
                        updateLocalization(langCode, "image", e.target.value);
                      }
                    }}
                    placeholder="Or enter image URL manually"
                    disabled={isPending || uploadFile.isPending}
                    className="mt-2"
                  />

                  {langCode !== "en" && !currentLocalization?.image && (
                    <p className="text-xs text-muted-foreground">
                      No image for this locale. Will use default image: {form.image || "None"}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || isPending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

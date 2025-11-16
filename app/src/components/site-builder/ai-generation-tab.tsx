import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteGenerationContext } from "./site-generation-context";
import { SiteGenerationActions } from "./site-generation-actions";
import { SiteStatusDisplay } from "./site-status-display";
import { SiteVersionHistory } from "./site-version-history";
import { CustomDomainInput } from "./custom-domain-input";

interface BrandSite {
  id?: string;
  status?: "pending" | "generating" | "deploying" | "success" | "failed";
  deployedUrl?: string;
  error?: string;
  metadata?: { version?: number };
  versions?: Array<{
    version: number;
    description?: string;
    createdAt?: string;
    previewUrl?: string;
  }>;
}

interface AIGenerationTabProps {
  // Context
  context: string;
  onContextChange: (value: string) => void;
  contextImages: string[];
  onContextImageUpload: (file: File) => Promise<void>;
  onContextImageRemove: (index: number) => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;

  // Site generation
  brandSites: BrandSite[];
  currentBrandSite: BrandSite | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  isRegenerating: boolean;

  // Version management
  currentVersion: number | null;
  previewingVersion: number | null;
  onPreviewVersion: (version: number) => Promise<void>;
  onRestoreVersion: (version: number) => void;
  isRestoring: boolean;

  // Custom domain
  customDomain: string;
  onCustomDomainChange: (value: string) => void;
  onAddDomain: () => void;
  isAddingDomain: boolean;
  domainStatus?: string;
  dnsConfigured?: boolean;
  dnsInstructions?: {
    type: "A" | "CNAME";
    name: string;
    value: string;
    ttl?: number;
  };
  message?: string;

  // Error display
  generationError: Error | null;
}

export function AIGenerationTab({
  context,
  onContextChange,
  contextImages,
  onContextImageUpload,
  onContextImageRemove,
  isUploading,
  uploadProgress,
  uploadError,
  brandSites,
  currentBrandSite,
  onGenerate,
  onRegenerate,
  isGenerating,
  isRegenerating,
  currentVersion,
  previewingVersion,
  onPreviewVersion,
  onRestoreVersion,
  isRestoring,
  customDomain,
  onCustomDomainChange,
  onAddDomain,
  isAddingDomain,
  domainStatus,
  dnsConfigured,
  dnsInstructions,
  message,
  generationError,
}: AIGenerationTabProps) {
  const hasExistingSite = brandSites.length > 0;
  const displaySite = currentBrandSite || brandSites[0] || null;
  const isProcessing = displaySite?.status === "generating" || displaySite?.status === "deploying";

  return (
    <Card className="shadow-sm border-gray-200/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          Site Generation
        </CardTitle>
        <CardDescription className="ml-11">
          Provide context and instructions to generate or regenerate your website.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SiteGenerationContext
          context={context}
          onContextChange={onContextChange}
          contextImages={contextImages}
          onContextImageUpload={onContextImageUpload}
          onContextImageRemove={onContextImageRemove}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
        />

        <div className="space-y-3">
          <SiteGenerationActions
            hasExistingSite={hasExistingSite}
            onGenerate={onGenerate}
            onRegenerate={onRegenerate}
            isGenerating={isGenerating}
            isRegenerating={isRegenerating}
            isProcessing={isProcessing}
          />

          {displaySite && (
            <SiteStatusDisplay brandSite={displaySite} />
          )}

          {generationError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                {generationError.message || "Failed to start site generation. Please try again."}
              </p>
            </div>
          )}

          {hasExistingSite && displaySite && (
            <SiteVersionHistory
              brandSite={displaySite}
              currentVersion={currentVersion}
              previewingVersion={previewingVersion}
              onPreviewVersion={onPreviewVersion}
              onRestoreVersion={onRestoreVersion}
              isRestoring={isRestoring}
            />
          )}

          {hasExistingSite && (
            <CustomDomainInput
              customDomain={customDomain}
              onCustomDomainChange={onCustomDomainChange}
              onAddDomain={onAddDomain}
              isAdding={isAddingDomain}
              domainStatus={domainStatus}
              dnsConfigured={dnsConfigured}
              dnsInstructions={dnsInstructions}
              message={message}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}


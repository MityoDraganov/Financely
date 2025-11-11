import { Code } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteStatusDisplay } from "./site-status-display";
import { FileEditor } from "./file-editor";
import { ManualEditorEmptyState } from "./manual-editor-empty-state";

interface BrandSite {
  id?: string;
  status?: "pending" | "generating" | "deploying" | "success" | "failed";
  deployedUrl?: string;
  error?: string;
  files?: Record<string, string>;
  html?: string;
}

interface ManualEditorTabProps {
  hasSite: boolean;
  brandSite: BrandSite | null;
  organizationId: string;
  organizationName: string;
  companyName?: string;
  projectId: string;
  onCreateBlankSite: () => void;
  isCreating: boolean;
  onSaveFiles: (files: Record<string, string>) => Promise<void>;
  onDeployFiles: (files: Record<string, string>) => Promise<void>;
  widgetsEnabled: boolean;
}

export function ManualEditorTab({
  hasSite,
  brandSite,
  organizationId,
  organizationName,
  companyName,
  projectId,
  onCreateBlankSite,
  isCreating,
  onSaveFiles,
  onDeployFiles,
  widgetsEnabled,
}: ManualEditorTabProps) {
  if (!hasSite) {
    return (
      <ManualEditorEmptyState
        organizationName={organizationName}
        companyName={companyName}
        onCreateBlankSite={onCreateBlankSite}
        isCreating={isCreating}
      />
    );
  }

  return (
    <Card className="shadow-sm border-gray-200/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Code className="h-4 w-4 text-blue-600" />
          </div>
          Code Editor
        </CardTitle>
        <CardDescription className="ml-11">
          Edit your site files directly. Changes are saved automatically when you deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {brandSite && <SiteStatusDisplay brandSite={brandSite} />}

        <FileEditor
          files={brandSite?.files || (brandSite?.html ? { "index.html": brandSite.html } : {})}
          onSave={onSaveFiles}
          onDeploy={onDeployFiles}
          organizationId={organizationId}
          projectId={projectId}
        />
      </CardContent>
    </Card>
  );
}


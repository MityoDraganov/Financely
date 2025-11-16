import { Code, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ManualEditorEmptyStateProps {
  onCreateBlankSite: () => void;
  isCreating: boolean;
}

export function ManualEditorEmptyState({
  onCreateBlankSite,
  isCreating,
}: ManualEditorEmptyStateProps) {
  return (
    <Card className="shadow-sm border-gray-200/50">
      <CardContent className="p-8 text-center">
        <Code className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">No Site Created Yet</h3>
        <p className="text-sm text-gray-500 mb-4">
          Create a site using AI generation first, or start with a blank template.
        </p>
        <Button
          onClick={onCreateBlankSite}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Create Blank Site
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}


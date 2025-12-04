import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { ExtractionJob } from "@/repositories/extraction-job-repository";
import { cn } from "@/lib/utils";

interface ExtractionResultsPanelProps {
  job: ExtractionJob;
  onFieldChange?: (field: string, value: unknown) => void;
  onSave?: (data: Record<string, unknown>) => void;
}

export function ExtractionResultsPanel({
  job,
  onFieldChange,
  onSave,
}: ExtractionResultsPanelProps) {
  const [editedData, setEditedData] = useState<Record<string, unknown>>(
    job.correctedData || job.extractedData || {}
  );

  if (!job.extractedData || Object.keys(job.extractedData).length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center">
            No data extracted yet. Please wait for extraction to complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleFieldChange = (field: string, value: unknown) => {
    const updated = { ...editedData, [field]: value };
    setEditedData(updated);
    onFieldChange?.(field, value);
  };

  const handleSave = () => {
    onSave?.(editedData);
  };

  const getConfidenceBadge = (field: string) => {
    const confidence = job.confidenceScores?.[field];
    if (!confidence) return null;

    const isHigh = confidence >= 0.8;
    const isMedium = confidence >= 0.5 && confidence < 0.8;

    return (
      <Badge
        variant={isHigh ? "default" : isMedium ? "secondary" : "destructive"}
        className="ml-2"
      >
        {isHigh ? (
          <CheckCircle2 className="h-3 w-3 mr-1" />
        ) : (
          <AlertCircle className="h-3 w-3 mr-1" />
        )}
        {(confidence * 100).toFixed(0)}%
      </Badge>
    );
  };

  const renderField = (key: string, value: unknown, path = ""): React.ReactNode => {
    const fullPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-3">
          <Label className="text-base font-semibold capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </Label>
          <div className="pl-4 space-y-3 border-l-2 border-muted">
            {Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) =>
              renderField(subKey, subValue, fullPath)
            )}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={fullPath} className="space-y-3">
          <Label className="text-base font-semibold capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </Label>
          <div className="space-y-2">
            {value.map((item, index) => (
              <Card key={index} className="p-3">
                <CardContent className="p-0">
                  {typeof item === "object" && item !== null
                    ? Object.entries(item).map(([itemKey, itemValue]) =>
                        renderField(itemKey, itemValue, `${fullPath}[${index}]`)
                      )
                    : (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">
                            Item {index + 1}:
                          </Label>
                          <Input
                            value={String(item)}
                            onChange={(e) => {
                              const updated = [...value];
                              updated[index] = e.target.value;
                              handleFieldChange(fullPath, updated);
                            }}
                            className="flex-1"
                          />
                        </div>
                      )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={fullPath} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={fullPath} className="text-sm font-medium capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </Label>
          {getConfidenceBadge(fullPath)}
        </div>
        <Input
          id={fullPath}
          value={String(value)}
          onChange={(e) => {
            // Try to preserve type
            let typedValue: unknown = e.target.value;
            if (typeof value === "number") {
              typedValue = parseFloat(e.target.value) || 0;
            } else if (typeof value === "boolean") {
              typedValue = e.target.value === "true";
            }
            handleFieldChange(fullPath, typedValue);
          }}
          className={cn(
            job.confidenceScores?.[fullPath] !== undefined &&
              job.confidenceScores[fullPath] < 0.5 &&
              "border-destructive"
          )}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extracted Invoice Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {Object.entries(job.extractedData).map(([key, value]) =>
            renderField(key, value)
          )}
        </div>

        {onSave && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleSave} variant="default">
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


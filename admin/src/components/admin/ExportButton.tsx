import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps<T> {
  data: T[];
  filename: string;
  exportFormat?: "csv" | "json";
  transform?: (item: T) => Record<string, unknown>;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  exportFormat = "csv",
  transform,
}: ExportButtonProps<T>) {
  const handleExport = () => {
    try {
      if (exportFormat === "json") {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data exported as JSON");
      } else {
        // CSV export
        const transformedData = transform ? data.map(transform) : data;
        const headers = Object.keys(transformedData[0] || {});
        const csvRows = [
          headers.join(","),
          ...transformedData.map((row) =>
            headers
              .map((header) => {
                const value = row[header];
                if (value === null || value === undefined) return "";
                const stringValue = String(value);
                // Escape quotes and wrap in quotes if contains comma, newline, or quote
                if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
                  return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
              })
              .join(",")
          ),
        ];
        const csv = csvRows.join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data exported as CSV");
      }
    } catch (error) {
      toast.error(`Failed to export data: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <Button onClick={handleExport} variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      Export {exportFormat.toUpperCase()}
    </Button>
  );
}


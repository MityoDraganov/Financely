import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { ImportWizard } from "@/components/export-import/import-wizard";
import { JobStatus } from "@/components/export-import/job-status";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DataManagementPage() {
  const { data: organization } = useCurrentOrganization();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobType, setActiveJobType] = useState<"export" | "import" | null>(null);

  const handleExportComplete = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveJobType("export");
    setShowExportDialog(false);
  };

  const handleImportComplete = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveJobType("import");
    setShowImportWizard(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Management</h2>
        <p className="text-muted-foreground">
          Export and import your organization data in CSV, XLS, or XLSX formats.
        </p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Export your data to CSV, XLS, or XLSX format. Select multiple entity types
                to export everything at once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <h4 className="font-medium mb-2">What can be exported?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Products - All product information, pricing, inventory</li>
                    <li>Contacts - Customer and contact information</li>
                    <li>Leads - Lead submissions and form data</li>
                    <li>Proposals - Proposal details and line items</li>
                    <li>Invoices - Invoice data and metadata</li>
                    <li>Templates - Template configurations</li>
                  </ul>
                </div>

                <Button onClick={() => setShowExportDialog(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Start Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {activeJobId && activeJobType === "export" && organization?.id && (
            <JobStatus
              orgId={organization.id}
              jobId={activeJobId}
              type="export"
              onComplete={() => {
                setActiveJobId(null);
                setActiveJobType(null);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Import data from CSV, XLS, or XLSX files. Supports both create-only and
                upsert modes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4">
                  <h4 className="font-medium mb-2">Import Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Automatic column mapping and validation</li>
                    <li>Create-only mode: Always create new records</li>
                    <li>Upsert mode: Update existing or create new</li>
                    <li>Detailed error reports for failed rows</li>
                    <li>Support for CSV, XLS, and XLSX formats</li>
                  </ul>
                </div>

                <Button onClick={() => setShowImportWizard(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Start Import
                </Button>
              </div>
            </CardContent>
          </Card>

          {activeJobId && activeJobType === "import" && organization?.id && (
            <JobStatus
              orgId={organization.id}
              jobId={activeJobId}
              type="import"
              onComplete={() => {
                setActiveJobId(null);
                setActiveJobType(null);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExportComplete={handleExportComplete}
      />

      <ImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  useExtractInvoiceData,
  useExtractionJob 
} from "@/hooks/service-hooks/use-invoice-extraction";
import { InvoiceFileUpload } from "@/components/invoice-extraction/invoice-file-upload";
import { ExtractionJobStatus } from "@/components/invoice-extraction/extraction-job-status";
import { ExtractionResultsPanel } from "@/components/invoice-extraction/extraction-results-panel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadInvoicePage() {
  const navigate = useNavigate();
  const [jobId, setJobId] = useState<string | null>(null);
  const extractMutation = useExtractInvoiceData();
  const { data: job, isLoading: isLoadingJob } = useExtractionJob(jobId);
  
  // Only show loading if we have a jobId but no job data yet (initial load)
  const isInitialLoading = isLoadingJob && jobId && !job;

  const handleUploadSuccess = (uploadedJobId: string) => {
    setJobId(uploadedJobId);
    // Automatically start extraction after a short delay
    setTimeout(() => {
      extractMutation.mutate(uploadedJobId);
    }, 500);
  };

  const handleExtractClick = () => {
    if (jobId) {
      extractMutation.mutate(jobId);
    }
  };

  // Auto-extract when job is uploaded and pending
  useEffect(() => {
    if (job && job.status === "pending" && !extractMutation.isPending && extractMutation.isIdle) {
      extractMutation.mutate(job.id);
    }
  }, [job, extractMutation]);

  return (
    <AppLayout>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/invoices")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Upload Invoice</h1>
            <p className="text-muted-foreground">
              Upload an invoice file to automatically extract data using Google Cloud Vision API and AI
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Upload Invoice File
              </CardTitle>
              <CardDescription>
                Upload a PDF or image file of your invoice. We'll automatically extract
                the data using Google Cloud Vision API and AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceFileUpload
                onUploadSuccess={handleUploadSuccess}
                maxSizeMB={20}
              />
            </CardContent>
          </Card>

          {/* Status Section */}
          {jobId && (
            <Card>
              <CardHeader>
                <CardTitle>Extraction Status</CardTitle>
                <CardDescription>
                  Monitor the progress of your invoice extraction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isInitialLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <ExtractionJobStatus jobId={jobId} showDetails={true} />
                    
                    {job && job.status === "pending" && extractMutation.isIdle && (
                      <Button
                        onClick={handleExtractClick}
                        className="w-full"
                        disabled={extractMutation.isPending}
                      >
                        {extractMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Starting Extraction...
                          </>
                        ) : (
                          "Start Extraction"
                        )}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results Section */}
        {job && job.status !== "pending" && job.status !== "processing" && (
          <Card>
            <CardHeader>
              <CardTitle>Extracted Data</CardTitle>
              <CardDescription>
                Review and correct the extracted invoice data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {job.extractedData ? (
                <ExtractionResultsPanel job={job} />
              ) : (
                <p className="text-sm text-muted-foreground text-center p-8">
                  {job.status === "failed" 
                    ? "Extraction failed. Please try uploading again."
                    : "No data extracted yet."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

